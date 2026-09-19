"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface RealtimeMessage {
  id: string;
  role: "patient" | "assistant" | "system";
  text: string;
  timestamp: string;
  capabilityCalled?: string;
  capabilityResult?: any;
}

export interface UseRealtimeVoiceOptions {
  onMessage?: (msg: RealtimeMessage) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onError?: (err: string) => void;
}

export function useRealtimeVoice({ onMessage, onToolCall, onError }: UseRealtimeVoiceOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio volume analyzer for live visualizer
  const startVolumeAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Normalize to 0 - 100
        setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.warn("Could not start audio analyser", e);
    }
  };

  const stopVolumeAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setVolumeLevel(0);
  };

  const disconnect = useCallback(() => {
    stopVolumeAnalyser();

    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch (e) {}
      dcRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsInterrupted(false);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setSessionError(null);

    try {
      // 1. Fetch ephemeral session token from backend
      const tokenRes = await fetch("/api/realtime/session", { method: "POST" });
      const sessionData = await tokenRes.json();

      if (!tokenRes.ok || sessionData.error) {
        const msg = sessionData.message || sessionData.error || "Failed to initialize realtime session";
        setSessionError(msg);
        onError?.(msg);
        setIsConnecting(false);
        return;
      }

      const ephemeralKey = sessionData.client_secret?.value;
      if (!ephemeralKey) {
        throw new Error("No ephemeral client secret returned by Realtime API");
      }

      // 2. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      startVolumeAnalyser(stream);

      // 3. Create WebRTC PeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Handle remote audio output from OpenAI model
      if (!audioElRef.current) {
        const el = document.createElement("audio");
        el.autoplay = true;
        audioElRef.current = el;
      }

      pc.ontrack = (event) => {
        if (audioElRef.current && event.streams[0]) {
          audioElRef.current.srcObject = event.streams[0];
          setIsSpeaking(true);
        }
      };

      // Add local microphone audio track to WebRTC connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4. Create Data Channel for Realtime JSON Events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
      };

      dc.onclose = () => {
        disconnect();
      };

      dc.onerror = (e) => {
        console.error("WebRTC DataChannel error:", e);
      };

      // 5. Handle Realtime Events & Tool Calling
      dc.onmessage = async (e) => {
        try {
          const event = JSON.parse(e.data);

          // User speech started (Barge-in / Interruption)
          if (event.type === "input_audio_buffer.speech_started") {
            setIsUserSpeaking(true);
            setIsInterrupted(true);
            setIsSpeaking(false);
            setTimeout(() => setIsInterrupted(false), 1500);
          }

          if (event.type === "input_audio_buffer.speech_stopped") {
            setIsUserSpeaking(false);
          }

          // User speech transcribed
          if (event.type === "conversation.item.input_audio_transcription.completed") {
            const transcript = event.transcript?.trim();
            if (transcript) {
              onMessage?.({
                id: `msg-user-${Date.now()}`,
                role: "patient",
                text: transcript,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              });
            }
          }

          // Assistant speech transcribed
          if (event.type === "response.audio_transcript.done") {
            const text = event.transcript?.trim();
            if (text) {
              onMessage?.({
                id: `msg-ai-${Date.now()}`,
                role: "assistant",
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              });
            }
          }

          if (event.type === "response.done") {
            setIsSpeaking(false);
          }

          // FUNCTION CALLING (Tool Execution)
          if (event.type === "response.function_call_arguments.done") {
            const { name, call_id, arguments: argsJson } = event;
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(argsJson);
            } catch (err) {}

            console.log(`[Realtime Tool Call] Executing ${name}:`, parsedArgs);

            // Execute tool through AuraCare CapabilityManager via API route
            let toolResult: any = { error: "Execution failed" };
            try {
              const res = await fetch("/api/capabilities/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  capability: name,
                  params: parsedArgs,
                }),
              });
              toolResult = await res.json();
            } catch (err: any) {
              toolResult = { error: err.message };
            }

            onToolCall?.(name, parsedArgs, toolResult);

            // Send tool result back to the model over WebRTC data channel
            if (dc.readyState === "open") {
              dc.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id,
                    output: JSON.stringify(toolResult),
                  },
                })
              );

              // Instruct model to respond with voice using the tool result
              dc.send(JSON.stringify({ type: "response.create" }));
            }
          }
        } catch (err) {
          console.error("Error processing data channel event", err);
        }
      };

      // 6. Create SDP Offer & negotiate with OpenAI WebRTC endpoint
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI SDP handshake failed: ${await sdpResponse.text()}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err: any) {
      console.error("[useRealtimeVoice error]", err);
      const msg = err.message || "Failed to establish WebRTC realtime stream";
      setSessionError(msg);
      onError?.(msg);
      disconnect();
    }
  }, [isConnected, isConnecting, disconnect, onError, onMessage, onToolCall]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    isConnecting,
    isSpeaking,
    isUserSpeaking,
    isInterrupted,
    volumeLevel,
    sessionError,
  };
}
