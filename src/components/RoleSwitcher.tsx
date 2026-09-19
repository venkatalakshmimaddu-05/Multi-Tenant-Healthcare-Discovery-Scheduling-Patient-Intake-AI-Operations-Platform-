"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  User, 
  Stethoscope, 
  Building2, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  Radio, 
  AlertTriangle, 
  CheckCircle2,
  Phone
} from "lucide-react";

export function RoleSwitcher() {
  const pathname = usePathname();
  const [ehrMode, setEhrMode] = useState<string>("NORMAL");
  const [isReseeding, setIsReseeding] = useState(false);
  const [reseedStatus, setReseedStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ehr/simulate-failure")
      .then((res) => res.json())
      .then((data) => {
        if (data.mode) setEhrMode(data.mode);
      })
      .catch(() => {});
  }, []);

  const handleEhrChange = async (newMode: string) => {
    setEhrMode(newMode);
    try {
      await fetch("/api/ehr/simulate-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleReseed = async () => {
    setIsReseeding(true);
    setReseedStatus("Reseeding database...");
    try {
      const res = await fetch("/api/reset-seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setReseedStatus("Database Reset Done!");
        setTimeout(() => {
          setReseedStatus(null);
          window.location.reload();
        }, 1200);
      }
    } catch (err) {
      setReseedStatus("Failed to reset");
      setTimeout(() => setReseedStatus(null), 2000);
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white text-xs border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Role Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mr-1 hidden sm:inline">
            Role Switcher:
          </span>

          <Link
            href="/patient/assistant"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
              pathname === "/patient/assistant"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>AI Voice & Phone Agent</span>
          </Link>

          <Link
            href="/patient"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
              pathname === "/patient"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Patient Portal</span>
          </Link>

          <Link
            href="/doctor"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
              pathname === "/doctor"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
            <span>Doctor Portal</span>
          </Link>

          <Link
            href="/hospital-admin"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
              pathname === "/hospital-admin"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Hospital Admin</span>
          </Link>

          <Link
            href="/platform-admin"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition ${
              pathname === "/platform-admin"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Platform Admin & Traces</span>
          </Link>
        </div>

        {/* Right: EHR Fault Injection & Reseed Button */}
        <div className="flex items-center gap-2">
          {/* EHR Simulation Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400 text-[11px] hidden md:inline">EHR Mode:</span>
            <select
              value={ehrMode}
              onChange={(e) => handleEhrChange(e.target.value)}
              className="bg-transparent text-white font-medium text-[11px] outline-none cursor-pointer"
            >
              <option value="NORMAL" className="bg-slate-800 text-emerald-400">
                🟢 Normal (Auto-Verify)
              </option>
              <option value="TIMEOUT" className="bg-slate-800 text-amber-400">
                🟡 Option A: EHR Timeout & Retry
              </option>
              <option value="UNKNOWN_OUTCOME" className="bg-slate-800 text-blue-400">
                🔵 Option B: Unknown Outcome Recovery
              </option>
              <option value="OUTAGE" className="bg-slate-800 text-rose-400">
                🔴 Option C: Unrecoverable & Escalate
              </option>
            </select>
          </div>

          {/* Quick Reseed Button */}
          <button
            onClick={handleReseed}
            disabled={isReseeding}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Reset database to initial pristine state"
          >
            <RefreshCw className={`w-3 h-3 ${isReseeding ? "animate-spin" : ""}`} />
            <span>{reseedStatus ? reseedStatus : "Reseed DB"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}