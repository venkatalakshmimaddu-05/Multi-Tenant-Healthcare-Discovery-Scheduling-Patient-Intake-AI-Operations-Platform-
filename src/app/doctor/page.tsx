"use client";

import React, { useState, useEffect } from "react";
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  FileText, 
  Ban, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  RefreshCw,
  Eye
} from "lucide-react";

export default function DoctorPortal() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [doctorData, setDoctorData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntake, setSelectedIntake] = useState<any | null>(null);

  // Block slot form state
  const [blockReason, setBlockReason] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await fetch("/api/doctors");
      const docs = res.ok ? await res.json() : [];
      const validDocs = Array.isArray(docs) ? docs : [];
      setDoctors(validDocs);
      if (validDocs.length > 0) {
        setSelectedDoctorId(validDocs[0].id);
        fetchDoctorDetails(validDocs[0].id);
      }
    } catch (err) {
      console.error(err);
      setDoctors([]);
    }
  };

  const fetchDoctorDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctors?doctorId=${id}`);
      const data = await res.json();
      setDoctorData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    fetchDoctorDetails(id);
  };

  const handleBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTime || !selectedDoctorId) return;

    setBlocking(true);
    try {
      const startTime = new Date(blockTime);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour block

      await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BLOCK_SLOT",
          doctorId: selectedDoctorId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason: blockReason || "Scheduled Clinic Surgery / Ward Round",
        }),
      });

      setBlockReason("");
      setBlockTime("");
      await fetchDoctorDetails(selectedDoctorId);
    } catch (err) {
      console.error(err);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
      {/* Header & Doctor Selector */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
            <Stethoscope className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Doctor Clinical Dashboard</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                Provider Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage doctor-controlled calendars, slot blocking, and review pre-visit patient questionnaires.
            </p>
          </div>
        </div>

        {/* Doctor Persona Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Active Physician:</span>
          <select
            value={selectedDoctorId}
            onChange={(e) => handleDoctorChange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {(Array.isArray(doctors) ? doctors : []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty?.name} ({d.hospital?.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !doctorData ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          Loading physician schedule and intake data...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Schedule & Appointments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Appointments List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-sm text-slate-900">Upcoming Patient Consultations</h2>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                  {doctorData.appointments?.length || 0} Scheduled
                </span>
              </div>

              {doctorData.appointments?.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-8">
                  No appointments booked for this physician yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {doctorData.appointments.map((appt: any) => (
                    <div
                      key={appt.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{appt.patient?.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              appt.status === "CONFIRMED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(appt.startTime).toLocaleString("en-US", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          <span>•</span>
                          <span>EHR ID: {appt.externalAppointmentId || "Pending"}</span>
                        </div>
                      </div>

                      {/* Intake Review Button */}
                      {appt.questionnaireResponses && appt.questionnaireResponses.length > 0 ? (
                        <button
                          onClick={() => setSelectedIntake(appt.questionnaireResponses[0])}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Pre-Visit Intake</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Intake Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocked Slots Section (Doctor Controlled Availability - PRD Sec 5 & 6) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-rose-600" />
                  <h2 className="font-bold text-sm text-slate-900">Blocked Slots & Time-Off</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">Doctor Availability Rule</span>
              </div>

              {doctorData.blockedSlots?.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">No active blocked periods.</div>
              ) : (
                <div className="space-y-2">
                  {doctorData.blockedSlots.map((block: any) => (
                    <div
                      key={block.id}
                      className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-rose-900">{block.reason}</div>
                        <div className="text-[11px] text-rose-700">
                          {new Date(block.startTime).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          -{" "}
                          {new Date(block.endTime).toLocaleTimeString("en-US", {
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                      <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">
                        BLOCKED
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Form to block a new slot */}
              <form onSubmit={handleBlockSlot} className="bg-slate-50 p-4 rounded-xl space-y-3 text-xs">
                <div className="font-semibold text-slate-700">Block New Time Slot</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="datetime-local"
                    value={blockTime}
                    onChange={(e) => setBlockTime(e.target.value)}
                    required
                    className="p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Reason (e.g. Surgery, Rounds, Leave)"
                    required
                    className="p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={blocking}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition"
                >
                  {blocking ? "Blocking..." : "Block Slot"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Col: Doctor Details & Intake Modal */}
          <div className="space-y-6">
            {/* Physician Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  DR
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{doctorData.name}</h3>
                  <div className="text-xs text-slate-500">{doctorData.specialty?.name}</div>
                </div>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Hospital:</span> {doctorData.hospital?.name}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Qualifications:</span>{" "}
                  {doctorData.qualifications}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Experience:</span>{" "}
                  {doctorData.experienceYears} Years
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Consultation Duration:</span>{" "}
                  {doctorData.durationMinutes} minutes
                </div>
                <div>
                  <span className="font-semibold text-slate-800">External Provider ID:</span>{" "}
                  <span className="font-mono text-slate-900">{doctorData.externalProviderId}</span>
                </div>
              </div>
            </div>

            {/* Pre-Visit Questionnaire Modal / Inspector */}
            {selectedIntake && (
              <div className="bg-white rounded-2xl border border-sky-300 p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <span>Patient Pre-Visit Intake Record</span>
                  </div>
                  <button
                    onClick={() => setSelectedIntake(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-sky-50 p-2.5 rounded-lg text-sky-800 text-[11px]">
                    Completed at: {new Date(selectedIntake.completedAt).toLocaleString()}
                  </div>

                  <div className="space-y-2">
                    {Object.entries(JSON.parse(selectedIntake.responsesJson || "{}")).map(
                      ([key, val]: any) => (
                        <div key={key} className="bg-slate-50 p-2.5 rounded-lg">
                          <div className="font-semibold text-slate-700 capitalize text-[11px]">
                            {key.replace("q_", "").replace("_", " ")}:
                          </div>
                          <div className="text-slate-900 font-medium mt-0.5">{String(val)}</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}