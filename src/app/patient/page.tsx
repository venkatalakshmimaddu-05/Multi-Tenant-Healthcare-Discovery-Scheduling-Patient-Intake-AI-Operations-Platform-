"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { 
  Calendar, 
  Clock, 
  User, 
  Stethoscope, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  Radio, 
  ArrowRight, 
  ShieldCheck
} from "lucide-react";

function PatientPortalContent() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const data = res.ok ? await res.json() : [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setActionLoading(appointmentId);
    try {
      await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", appointmentId }),
      });
      await fetchAppointments();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
      {/* Patient Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xl">
            AM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Alex Morgan</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                Active Patient
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
              <span>Email: alex.morgan@example.com</span>
              <span>•</span>
              <span>Phone: +1-555-0199</span>
              <span>•</span>
              <span>External EHR ID: EXT-PAT-9001</span>
            </div>
          </div>
        </div>

        <Link
          href="/patient/assistant"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-xs transition shadow-sm"
        >
          <Radio className="w-4 h-4 text-white animate-pulse" />
          <span>Launch AI Voice Assistant</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Appointments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Medical Appointments</h2>
            <p className="text-xs text-slate-500">
              Real-time booking records synchronized and verified with hospital EHR systems.
            </p>
          </div>

          <button
            onClick={fetchAppointments}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            Loading appointments...
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-sm text-slate-700">No appointments scheduled yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Use the AI Voice Agent to describe your condition and book an appointment with verified real availability.
            </p>
            <Link
              href="/patient/assistant"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
            >
              <Radio className="w-3.5 h-3.5 text-white" />
              <span>Book with Voice Assistant</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(appointments) ? appointments : []).map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{appt.doctor?.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {appt.doctor?.specialty?.name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{appt.hospital?.name}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      appt.status === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-800"
                        : appt.status === "RESCHEDULED"
                        ? "bg-blue-100 text-blue-800"
                        : appt.status === "CANCELLED"
                        ? "bg-rose-100 text-rose-800"
                        : appt.status === "RECONCILIATION_REQUIRED"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    <span>
                      {new Date(appt.startTime).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>
                      {new Date(appt.startTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* EHR Verification Badge */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>EHR Record:</span>
                    <span className="font-mono text-slate-900 font-medium">
                      {appt.externalAppointmentId || "Pending Sync"}
                    </span>
                  </div>

                  {appt.status === "CONFIRMED" && (
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={actionLoading === appt.id}
                      className="text-rose-600 hover:text-rose-700 font-medium text-xs transition"
                    >
                      {actionLoading === appt.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </div>

                {/* Intake Questionnaire status */}
                {appt.questionnaireResponses && appt.questionnaireResponses.length > 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pre-visit intake questionnaire completed</span>
                  </div>
                ) : (
                  <div className="bg-sky-50 border border-sky-100 p-2 rounded-lg flex items-center justify-between text-[11px] text-sky-800">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-600" />
                      <span>Pre-visit intake required</span>
                    </div>
                    <Link
                      href="/patient/assistant"
                      className="font-semibold underline hover:text-sky-900"
                    >
                      Complete in Assistant
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(PatientPortalContent), {
  ssr: false,
  loading: () => (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin"></div>
      <span>Loading Patient Workspace...</span>
    </div>
  ),
});