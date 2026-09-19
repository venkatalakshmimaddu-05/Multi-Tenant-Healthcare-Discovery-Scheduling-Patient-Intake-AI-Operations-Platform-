"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRealtimeVoice } from "@/lib/hooks/useRealtimeVoice";
import { 
  Zap,
  Radio,
  AlertCircle,
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Send, 
  ArrowUp,
  Square,
  Plus,
  Check,
  X,
  Volume2, 
  VolumeX, 
  Sparkles, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  User, 
  Building2, 
  Calendar, 
  FileText, 
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight
} from "lucide-react";

interface Message {
  id: string;
  role: "patient" | "assistant" | "system";
  text: string;
  timestamp: string;
  isClinicalRefusal?: boolean;
  capabilityCalled?: string;
  capabilityResult?: any;
  latencyMs?: number;
}

export default function AssistantPage() {
  const [channelMode, setChannelMode] = useState<"REALTIME_STREAM" | "VOICE" | "TELEPHONE">("REALTIME_STREAM");
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const realtimeVoice = useRealtimeVoice({
    onMessage: (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.role === "patient" && questionnaireSubmitted) {
        setAssignedQuestionnaire(null);
        setQuestionnaireSubmitted(false);
        setQuestionnaireResponses({});
        setRecentBookedAppointment(null);
      }
    },
    onToolCall: (name, args, result) => {
      setActiveCapability({
        name,
        result: result.data || result,
      });
      if (name === "create_appointment" && result?.success) {
        const appt = result.data;
        setRecentBookedAppointment(appt);
        setQuestionnaireSubmitted(false);
        setQuestionnaireResponses({});
        fetchQuestionnaire(appt.id);
      }
      if (name === "get_questionnaire" && result?.data) {
        setAssignedQuestionnaire(result.data);
      }
    },
    onError: (err) => {
      setRealtimeNotice(err);
    },
  });

  const [conversationId, setConversationId] = useState<string>(() => "conv-" + Date.now());
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m0",
      role: "assistant",
      text: "Hello, I am the AuraCare Patient Access Agent. How can I help you today? You can describe any symptoms or doctor you need to see, such as: 'I need to see a dermatologist for skin rashes', or 'I need to see an orthopedic doctor for shoulder pain.'",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [activeCapability, setActiveCapability] = useState<any | null>(null);
  const [assignedQuestionnaire, setAssignedQuestionnaire] = useState<any | null>(null);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<Record<string, any>>({});
  const [questionnaireSubmitted, setQuestionnaireSubmitted] = useState(false);
  const [recentBookedAppointment, setRecentBookedAppointment] = useState<any | null>(null);
  const [autoSend, setAutoSend] = useState<boolean>(false); // Continuous mode default: never cuts off mid-sentence, user taps Done Speaking or toggles auto-send

  const handleResetSession = () => {
    cancelListening();
    if (realtimeVoice.isConnected) {
      realtimeVoice.disconnect();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    const newId = "conv-" + Date.now();
    setConversationId(newId);
    setMessages([
      {
        id: `m-${Date.now()}`,
        role: "assistant",
        text: "Hello, I am the AuraCare Patient Access Agent. How can I help you today? You can describe any symptoms or doctor you need to see, such as: 'I need to see a dermatologist for skin rashes', or 'I need to see an orthopedic doctor for shoulder pain.'",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setActiveCapability(null);
    setAssignedQuestionnaire(null);
    setRecentBookedAppointment(null);
    setQuestionnaireSubmitted(false);
    setInputMessage("");
    setSpeechStatus("Session reset. Context refreshed for new symptoms.");
  };

  // Telephone mode state
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const isListeningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const callActiveRef = useRef<boolean>(false);
  const priorSessionsTranscriptRef = useRef<string>("");
  const activeRecognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<any>(null);
  const autoReopenTimeoutRef = useRef<any>(null);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeCapability, assignedQuestionnaire]);

  // Handle Call Timer
  useEffect(() => {
    if (callActive) {
      timerIntervalRef.current = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
      setCallTimer(0);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [callActive]);



  const stopListeningAndSend = (textOverride?: string) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (autoReopenTimeoutRef.current) {
      clearTimeout(autoReopenTimeoutRef.current);
      autoReopenTimeoutRef.current = null;
    }

    isListeningRef.current = false;
    setIsListening(false);

    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.abort();
      } catch (e) {}
      activeRecognitionRef.current = null;
    }

    const textToSend = (textOverride || latestTranscriptRef.current || inputMessage).trim();
    priorSessionsTranscriptRef.current = "";
    latestTranscriptRef.current = "";

    if (textToSend) {
      console.log(`[STT Diagnostic] Submitting utterance (${textToSend.length} chars): "${textToSend}"`);
      setSpeechStatus("Transcribed: \"" + (textToSend.length > 38 ? textToSend.slice(0, 35) + "..." : textToSend) + "\"");
      handleSendMessage(textToSend);
      setTimeout(() => setSpeechStatus(null), 2500);
    } else {
      setSpeechStatus(null);
    }
  };

  const cancelListening = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (autoReopenTimeoutRef.current) {
      clearTimeout(autoReopenTimeoutRef.current);
      autoReopenTimeoutRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    priorSessionsTranscriptRef.current = "";
    latestTranscriptRef.current = "";

    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.abort();
      } catch (e) {}
      activeRecognitionRef.current = null;
    }
    setSpeechStatus(null);
  };

  const createAndStartRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!isListeningRef.current || isSpeakingRef.current) return;

    try {
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.abort();
        } catch (e) {}
        activeRecognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const browserLang = (typeof navigator !== "undefined" && navigator.language) ? navigator.language : "en-US";
      recognition.lang = browserLang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isListeningRef.current) {
          setIsListening(true);
          if (!latestTranscriptRef.current) {
            setSpeechStatus(
              autoSend
                ? "🎤 Listening... speak naturally (will auto-submit on 6s pause, or tap Done Speaking)"
                : "🎤 Listening... speak your complete thought at your own pace (tap Done Speaking when finished)"
            );
          }
        }
      };

      recognition.onresult = (event: any) => {
        // Echo Protection: If the assistant is speaking through speakers, ignore acoustic bleed
        if (isSpeakingRef.current || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
          return;
        }

        let sessionFinal = "";
        let sessionInterim = "";

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            sessionFinal += (sessionFinal ? " " : "") + text.trim();
          } else {
            sessionInterim += (sessionInterim ? " " : "") + text.trim();
          }
        }

        const currentSessionText = [sessionFinal, sessionInterim].filter(Boolean).join(" ").trim();

        const fullSpoken = [
          priorSessionsTranscriptRef.current,
          currentSessionText
        ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

        if (fullSpoken) {
          latestTranscriptRef.current = fullSpoken;
          setInputMessage(fullSpoken);
          setSpeechStatus(`Listening: "${fullSpoken}"`);

          // Clear any active silence timer because the user is actively speaking!
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          // Automatic Turn-Taking:
          // Give user a generous 6.0-second pause window before submitting when autoSend is active!
          if (autoSend) {
            silenceTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current && latestTranscriptRef.current.trim().length >= 2) {
                stopListeningAndSend(latestTranscriptRef.current.trim());
              }
            }, 6000);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          isListeningRef.current = false;
          setIsListening(false);
          setSpeechStatus("⚠️ Microphone permission blocked. Please click the lock or sliders icon next to localhost:3000 in your browser address bar and set Microphone to 'Allow'.");
        } else if (event.error === "audio-capture") {
          isListeningRef.current = false;
          setIsListening(false);
          setSpeechStatus("⚠️ Microphone hardware error: No microphone detected or device is in use by another program (e.g. Zoom/Teams).");
        } else if (event.error === "network") {
          isListeningRef.current = false;
          setIsListening(false);
          setSpeechStatus("⚠️ Network error: Browser speech recognition service is unreachable. Please verify your internet connection or type your message.");
        } else if (event.error === "no-speech") {
          // Normal background silence, continue listening
        } else if (event.error === "aborted") {
          // Expected when aborted programmatically
        }
      };

      recognition.onend = () => {
        // Continuous mode in Chrome frequently disconnects on brief pauses.
        // Before reconnecting, preserve all text transcribed so far into priorSessionsTranscriptRef:
        if (isListeningRef.current && !isSpeakingRef.current) {
          if (latestTranscriptRef.current) {
            priorSessionsTranscriptRef.current = latestTranscriptRef.current;
          }
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
          setTimeout(() => {
            if (isListeningRef.current && !isSpeakingRef.current) {
              createAndStartRecognition();
            }
          }, 150);
        }
      };

      activeRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition instance:", err);
      setTimeout(() => {
        if (isListeningRef.current && !isSpeakingRef.current) {
          try {
            createAndStartRecognition();
          } catch (e) {}
        }
      }, 300);
    }
  };

  const startListening = async () => {
    // Barge-in: cancel active speech synthesis immediately
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }

    cancelListening();

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechStatus("⚠️ Speech Recognition is not supported in this browser. Please open this page in Google Chrome or Microsoft Edge.");
      return;
    }

    // Explicitly prompt/verify microphone permissions via getUserMedia and immediately release:
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr: any) {
        console.warn("Microphone access denied:", micErr);
        setSpeechStatus("⚠️ Microphone access denied. Click the lock/sliders icon in your browser URL bar next to localhost:3000 and select 'Allow' for Microphone.");
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
    }

    try {
      isListeningRef.current = true;
      setIsListening(true);
      priorSessionsTranscriptRef.current = "";
      latestTranscriptRef.current = "";
      setSpeechStatus(
        autoSend
          ? "🎤 Listening... speak naturally (will auto-submit on 6s pause, or tap Done Speaking)"
          : "🎤 Listening... speak your complete thought at your own pace (tap Done Speaking when finished)"
      );

      createAndStartRecognition();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setSpeechStatus(`Could not start microphone: ${err.message}`);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListeningAndSend();
    } else {
      startListening();
    }
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    // CRITICAL HARDWARE ECHO MUTE: Stop microphone immediately before TTS starts speaking!
    cancelListening();

    window.speechSynthesis.cancel(); // Barge-in reset
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      // In Telephone Mode: automatically reopen microphone for the caller's turn
      if (channelMode === "TELEPHONE" && callActiveRef.current) {
        autoReopenTimeoutRef.current = setTimeout(() => {
          if (callActiveRef.current && !isSpeakingRef.current) {
            startListening();
          }
        }, 350);
      }
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = handleSpeechEnd;
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputMessage;
    if (!message.trim() || isProcessing) return;

    // Barge-in: stop speech
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    // If a previous questionnaire was already submitted from an earlier appointment,
    // clear it when the patient begins describing new symptoms or starts a new request
    if (questionnaireSubmitted) {
      setAssignedQuestionnaire(null);
      setQuestionnaireSubmitted(false);
      setQuestionnaireResponses({});
      setRecentBookedAppointment(null);
    }

    const patientMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "patient",
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, patientMsg]);
    setInputMessage("");
    setIsProcessing(true);

    const startTurnTime = Date.now();

    try {
      const res = await fetch("/api/ai/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
        }),
      });

      const data = await res.json();
      const elapsed = Date.now() - startTurnTime;
      setLatencyMs(elapsed);

      if (data.capabilityCalled) {
        setActiveCapability({
          name: data.capabilityCalled,
          result: data.capabilityResult,
        });

        // Check if appointment was confirmed or rescheduled
        const isBookingSuccess =
          (data.capabilityCalled === "create_appointment" && data.capabilityResult?.success) ||
          ((data.actionTaken === "APPOINTMENT_CONFIRMED" || data.actionTaken === "APPOINTMENT_RESCHEDULED") &&
            data.capabilityResult?.data?.id);

        if (isBookingSuccess) {
          const appt = data.capabilityResult.data;
          setRecentBookedAppointment(appt);
          setQuestionnaireSubmitted(false);
          setQuestionnaireResponses({});
          // Fetch assigned questionnaire
          fetchQuestionnaire(appt.id);
        }

        // When get_questionnaire capability is executed
        if (data.capabilityCalled === "get_questionnaire" && data.capabilityResult) {
          setAssignedQuestionnaire(data.capabilityResult);
        }
      }

      const assistantMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        role: "assistant",
        text: data.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isClinicalRefusal: data.isClinicalRefusal,
        capabilityCalled: data.capabilityCalled,
        latencyMs: elapsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Speak response in voice or telephone mode
      speakText(data.replyText);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: "system",
          text: "Connection delay or network error. Please try speaking again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchQuestionnaire = async (appointmentId: string) => {
    try {
      const res = await fetch(`/api/questionnaires?appointmentId=${appointmentId}`);
      const data = await res.json();
      if (data.questionnaire) {
        setAssignedQuestionnaire(data.questionnaire);
      }
      if (data.appointment) {
        setRecentBookedAppointment(data.appointment);
      }
      if (data.existingResponse) {
        setQuestionnaireSubmitted(true);
      } else {
        setQuestionnaireSubmitted(false);
        setQuestionnaireResponses({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuestionnaireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedQuestionnaire || !recentBookedAppointment) return;

    try {
      await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId: assignedQuestionnaire.id,
          appointmentId: recentBookedAppointment.id,
          patientId: recentBookedAppointment.patientId,
          responses: questionnaireResponses,
        }),
      });

      setQuestionnaireSubmitted(true);
      speakText("Thank you. Your pre-visit clinical questionnaire has been saved for your doctor to review.");
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
      {/* Main Conversational Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
        {/* Header with Mode Toggle and Metrics */}
        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>AuraCare AI Access Agent</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Administrative Discovery & Intake • Verified EHR Integration
              </div>
            </div>
          </div>

          {/* Channel Selector: Web Voice vs Telephone Simulator */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700 text-xs">
              <button
                onClick={() => {
                  setChannelMode("REALTIME_STREAM");
                  setCallActive(false);
                  cancelListening();
                }}
                className={`px-3 py-1 rounded font-medium transition flex items-center gap-1.5 ${
                  channelMode === "REALTIME_STREAM" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Live WebRTC Stream</span>
                <span className="text-[9px] bg-emerald-700/80 px-1 py-0.2 rounded font-mono hidden md:inline">ChatGPT Voice</span>
              </button>
              <button
                onClick={() => {
                  setChannelMode("VOICE");
                  setCallActive(false);
                }}
                className={`px-3 py-1 rounded font-medium transition flex items-center gap-1.5 ${
                  channelMode === "VOICE" ? "bg-sky-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Web Voice</span>
              </button>
              <button
                onClick={() => {
                  setChannelMode("TELEPHONE");
                }}
                className={`px-3 py-1 rounded font-medium transition flex items-center gap-1.5 ${
                  channelMode === "TELEPHONE" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Telephone Simulator</span>
              </button>
            </div>

            {/* New Consultation / Reset Context Button */}
            <button
              onClick={handleResetSession}
              title="Start a new consultation with fresh context"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">New Consultation</span>
            </button>

            {/* Sub-2s Latency Badge (PRD Section 11) */}
            {latencyMs !== null && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700 text-[11px] text-slate-300">
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Turn: {latencyMs}ms</span>
                {latencyMs < 2000 ? (
                  <span className="text-emerald-400 font-medium">(&lt;2s OK)</span>
                ) : (
                  <span className="text-amber-400 font-medium">(High)</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Telephone Call Bar (visible when in Telephone Simulator mode) */}
        {channelMode === "TELEPHONE" && (
          <div className="bg-purple-950/40 border-b border-purple-800/50 p-3 px-4 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${callActive ? "bg-emerald-400 animate-ping" : "bg-purple-400"}`} />
              <span className="font-semibold">Inbound Line: 1-800-METRO-CARE</span>
              <span className="text-purple-400">• Caller ID: Alex Morgan (+1-555-0199)</span>
            </div>
            <div className="flex items-center gap-3">
              {callActive && (
                <div className="font-mono text-xs bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700/50 text-purple-200">
                  Call Time: {formatTimer(callTimer)}
                </div>
              )}
              {!callActive ? (
                <button
                  onClick={() => {
                    setCallActive(true);
                    speakText("Thank you for calling Metro Health Medical Center. I am your autonomous intake assistant. How may I direct your care today?");
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `tel-${Date.now()}`,
                        role: "system",
                        text: "📞 [Telephone Inbound Call Connected] Caller verified as Alex Morgan (+1-555-0199). Inbound voice stream initialized.",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      },
                    ]);
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1.5 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Simulate Inbound Call</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCallActive(false);
                    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `tel-end-${Date.now()}`,
                        role: "system",
                        text: "📞 [Call Disconnected by Patient]",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      },
                    ]);
                  }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium flex items-center gap-1.5 transition"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 max-h-[500px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "patient" ? "items-end" : msg.role === "assistant" ? "items-start" : "items-center"
              }`}
            >
              {msg.role === "system" ? (
                <div className="text-xs bg-slate-200/80 text-slate-700 px-3 py-1 rounded-full text-center max-w-lg my-1">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[85%] space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                    {msg.role === "patient" ? (
                      <>
                        <User className="w-3 h-3 text-slate-500" />
                        <span>Patient (Alex Morgan)</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-sky-500" />
                        <span>AuraCare AI</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                        {msg.latencyMs && <span className="text-slate-400">({msg.latencyMs}ms)</span>}
                      </>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "patient"
                        ? "bg-sky-600 text-white rounded-tr-none shadow-sm"
                        : msg.isClinicalRefusal
                        ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-none"
                        : "bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {msg.isClinicalRefusal && (
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-700 mb-1">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Clinical Boundary Refusal (Administrative Safety Guardrail)</span>
                      </div>
                    )}
                    <p>{msg.text}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Thinking / Turn-taking state indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>Understanding intent, checking calendars & executing capabilities...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* ChatGPT Style Floating Voice Interface Modal (Active while listening) */}
        {isListening && (
          <div className="mx-4 my-2 p-5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl shadow-2xl border border-slate-800 flex flex-col items-center justify-center gap-3 animate-fadeIn relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-teal-500/10 blur-2xl pointer-events-none" />

            {/* Status Header */}
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 tracking-wide uppercase z-10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ChatGPT Voice Mode • Listening</span>
            </div>

            {/* ChatGPT Iconic Pulsing Audio Orb */}
            <div className="relative flex items-center justify-center my-3 z-10">
              {/* Outer pulsing ring */}
              <div className="absolute w-28 h-28 rounded-full bg-sky-500/20 animate-ping" />
              {/* Middle glowing aura */}
              <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-sky-400/40 via-indigo-500/40 to-teal-400/40 blur-md animate-pulse" />
              {/* Core morphing sphere */}
              <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-sky-400 via-cyan-300 to-indigo-500 shadow-xl shadow-sky-500/40 flex items-center justify-center p-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 bg-white rounded-full animate-wave-1 h-5" />
                  <div className="w-1.5 bg-white rounded-full animate-wave-2 h-7" />
                  <div className="w-1.5 bg-white rounded-full animate-wave-3 h-5" />
                </div>
              </div>
            </div>

            {/* Live recognized speech sentence */}
            <div className="text-center max-w-xl z-10 px-4 min-h-[48px] flex items-center justify-center">
              {latestTranscriptRef.current ? (
                <p className="text-sm sm:text-base font-medium text-slate-100 italic leading-snug">
                  "{latestTranscriptRef.current}"
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Speak your entire sentence clearly (e.g. "I have skin rashes and need to see a dermatologist")...
                </p>
              )}
            </div>

            {/* Action buttons: Cancel, Auto-send toggle, & Done Speaking */}
            <div className="flex items-center gap-3 z-10 pt-1 flex-wrap justify-center">
              <button
                type="button"
                onClick={cancelListening}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700 shadow-sm"
                title="Cancel Voice Input"
              >
                <X className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutoSend((prev) => !prev);
                  if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                  autoSend
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 text-white"
                }`}
                title="Toggle Auto-send on pause"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoSend ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span>{autoSend ? "Auto-Send: 5s pause" : "Manual: Click Done"}</span>
              </button>

              <button
                type="button"
                onClick={() => stopListeningAndSend()}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition hover:scale-105 active:scale-95"
                title="Done speaking, submit sentence"
              >
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>Done Speaking</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 z-10">
              {autoSend 
                ? "Listening to full sentences • Never cuts off • Auto-submits after 5s pause or tap Done" 
                : "Continuous Mode • Speak as long as you want • Tap Done Speaking when finished"}
            </span>
          </div>
        )}

        {/* Audio Visualizer Wave (When assistant is speaking) */}
        {!isListening && isSpeaking && (
          <div className="mx-4 my-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-sky-300 rounded-xl text-xs font-medium border border-slate-800 animate-fadeIn">
            <Volume2 className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>AuraCare AI is speaking... (Turn-taking active)</span>
            <div className="flex items-center gap-1 ml-2">
              <div className="w-1 h-4 bg-sky-400 rounded-full animate-wave-1" />
              <div className="w-1 h-5 bg-sky-400 rounded-full animate-wave-2" />
              <div className="w-1 h-4 bg-sky-400 rounded-full animate-wave-3" />
            </div>
          </div>
        )}

        {/* Quick Symptoms Suggestion Chips (Horizontal Scroll) */}
        <div className="px-4 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => handleSendMessage("I have skin rashes and need to see a dermatologist.")}
            className="whitespace-nowrap px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition flex items-center gap-1.5 font-medium shadow-2xs"
          >
            <span>🧴 Skin Rashes (Dermatology)</span>
          </button>
          <button
            onClick={() => handleSendMessage("I need to see an orthopedic doctor for shoulder pain.")}
            className="whitespace-nowrap px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition flex items-center gap-1.5 font-medium shadow-2xs"
          >
            <span>🦴 Shoulder Pain (Orthopedics)</span>
          </button>
          <button
            onClick={() => handleSendMessage("I have chest pain and heart palpitations.")}
            className="whitespace-nowrap px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition flex items-center gap-1.5 font-medium shadow-2xs"
          >
            <span>❤️ Chest Palpitations (Cardio)</span>
          </button>
          <button
            onClick={() => handleSendMessage("I have a fever and cold.")}
            className="whitespace-nowrap px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition flex items-center gap-1.5 font-medium shadow-2xs"
          >
            <span>🩺 Fever & Cold</span>
          </button>
          <button
            onClick={() => handleSendMessage("Actually, make that Friday.")}
            className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition font-medium"
          >
            "Make that Friday"
          </button>
          <button
            onClick={() => handleSendMessage("Can you diagnose what disease is causing my knee pain?")}
            className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full border border-slate-200/80 transition font-medium"
          >
            "Diagnose me" (Safety test)
          </button>
        </div>

        {/* Live Speech Diagnostic / Status Notification Banner */}
        {speechStatus && (
          <div className="mx-4 my-1.5 px-4 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all animate-fadeIn bg-amber-50 text-amber-900 border border-amber-200">
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{speechStatus}</span>
            </div>
            <button
              onClick={() => setSpeechStatus(null)}
              className="text-amber-700 hover:text-amber-950 text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ChatGPT Style Floating Input Capsule */}
        <div className="p-4 bg-white">
          <div className="w-full max-w-4xl mx-auto rounded-[28px] bg-slate-100/90 focus-within:bg-white border border-slate-200/90 focus-within:border-slate-300 focus-within:shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all p-3 flex flex-col gap-2">
            {/* Input area */}
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isListening ? "Listening live to your voice..." : "Message AuraCare..."}
              rows={1}
              className="w-full px-2 py-1 bg-transparent text-sm sm:text-base text-slate-800 placeholder-slate-400 border-none outline-none focus:ring-0 resize-none min-h-[36px] max-h-[140px]"
            />

            {/* Bottom bar inside capsule */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMessage("I have skin rashes and need to see a dermatologist.")}
                  className="w-8 h-8 rounded-full border border-slate-300/80 hover:bg-slate-200/70 text-slate-600 flex items-center justify-center transition"
                  title="Attach prompt"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  Verified EHR • Voice & Text
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice Mode button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                    isListening
                      ? "bg-rose-500 text-white shadow-md animate-pulse"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                  }`}
                  title={isListening ? "Stop voice listening" : "Voice input (ChatGPT Voice Mode)"}
                >
                  {isListening ? <Square className="w-3.5 h-3.5 fill-white" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* ChatGPT Circular Up-arrow Send button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isProcessing}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                    inputMessage.trim() && !isProcessing
                      ? "bg-black hover:bg-slate-800 text-white shadow-sm"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                  title="Send message (Enter)"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* ChatGPT Style Disclaimer */}
          <div className="text-center text-[11px] text-slate-400 mt-2">
            AuraCare Voice Agent can make mistakes. Verify critical clinical decisions with licensed healthcare staff.
          </div>
        </div>
      </div>

      {/* Right Drawer: Live Execution & Pre-Visit Questionnaire */}
      <div className="w-full md:w-96 flex flex-col gap-4">
        {/* Capability Inspector Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <SlidersHorizontal className="w-4 h-4 text-sky-600" />
              <span>Controlled Capabilities</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              PRD Sec 9 & 10
            </span>
          </div>

          {activeCapability ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-sky-50 text-sky-800 px-2.5 py-1.5 rounded-lg font-mono font-medium">
                <span>{activeCapability.name}()</span>
                <span className="text-[10px] bg-sky-200 px-1.5 py-0.5 rounded">EXECUTED</span>
              </div>

              {/* Progress verification chain if appointment creation */}
              {activeCapability.name === "create_appointment" && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5 text-[11px]">
                  <div className="font-semibold text-slate-700">Verification & Sync Chain:</div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>1. Slot Availability Locked</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>2. External EHR Request Dispatched</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>3. External Record Verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>4. Internal State: CONFIRMED</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>5. Pre-Visit Questionnaire Assigned</span>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto max-h-40">
                <pre>{JSON.stringify(activeCapability.result, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-6">
              Capability execution telemetry will appear here when the agent searches doctors, checks availability, or executes bookings.
            </div>
          )}
        </div>

        {/* Pre-Visit Questionnaire Card (PRD Section 15) */}
        {assignedQuestionnaire ? (
          <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Pre-Visit Intake Questionnaire</span>
              </div>
              <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded font-medium">
                {assignedQuestionnaire.specialty?.name || "General"}
              </span>
            </div>

            {recentBookedAppointment && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-snug">
                  <div className="font-semibold text-sky-950">
                    Confirmed with {recentBookedAppointment.doctor?.name || "Specialist"}
                  </div>
                  <div className="text-sky-700 mt-0.5">
                    {recentBookedAppointment.startTime
                      ? `${new Date(recentBookedAppointment.startTime).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })} at ${new Date(recentBookedAppointment.startTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : recentBookedAppointment.formattedTime || "Scheduled visit"}
                    {recentBookedAppointment.hospital?.name ? ` • ${recentBookedAppointment.hospital.name}` : ""}
                  </div>
                </div>
              </div>
            )}

            {questionnaireSubmitted ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <div className="text-xs font-bold text-emerald-800">Intake Responses Submitted!</div>
                <div className="text-[11px] text-emerald-700">
                  Your responses for {recentBookedAppointment?.doctor?.name || "your doctor"} have been securely transmitted to the clinical care team.
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuestionnaireSubmit} className="space-y-3 text-xs">
                <p className="text-[11px] text-slate-600 leading-snug">
                  {assignedQuestionnaire.description}
                </p>

                {JSON.parse(assignedQuestionnaire.schemaJson || "[]").map((field: any) => (
                  <div key={field.id} className="space-y-1">
                    <label className="font-medium text-slate-700 block text-[11px]">
                      {field.prompt}
                    </label>

                    {field.type === "choice" && (
                      <select
                        onChange={(e) =>
                          setQuestionnaireResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Select option --</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === "numeric" && (
                      <input
                        type="number"
                        min={field.min || 1}
                        max={field.max || 10}
                        onChange={(e) =>
                          setQuestionnaireResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder="Rating (1 - 10)"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    )}

                    {field.type === "yes_no" && (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            value="Yes"
                            onChange={(e) =>
                              setQuestionnaireResponses((prev) => ({ ...prev, [field.id]: "Yes" }))
                            }
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            value="No"
                            onChange={(e) =>
                              setQuestionnaireResponses((prev) => ({ ...prev, [field.id]: "No" }))
                            }
                          />
                          <span>No</span>
                        </label>
                      </div>
                    )}

                    {field.type === "long_text" && (
                      <textarea
                        rows={2}
                        onChange={(e) =>
                          setQuestionnaireResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder="Type any details..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition"
                >
                  Submit Pre-Visit Intake
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Pre-Visit Intake Questionnaire</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">
                Awaiting Booking
              </span>
            </div>
            <div className="py-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-700">Awaiting Appointment Booking</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Your clinical intake questionnaire will appear here automatically as soon as your appointment date and time are confirmed with your doctor.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}