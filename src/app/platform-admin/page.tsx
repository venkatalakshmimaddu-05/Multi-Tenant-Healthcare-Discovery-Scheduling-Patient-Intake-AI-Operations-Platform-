"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Building2, 
  Radio, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  ArrowRight,
  Database,
  Cpu,
  FileText
} from "lucide-react";

export default function PlatformAdminPortal() {
  const [activeTab, setActiveTab] = useState<"APPLICATIONS" | "TRACES" | "METRICS" | "FAILURES">("APPLICATIONS");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [searchCorrId, setSearchCorrId] = useState("");
  const [traceData, setTraceData] = useState<any | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Failure scenario state
  const [selectedFailureMode, setSelectedFailureMode] = useState<string>("NORMAL");
  const [failureResult, setFailureResult] = useState<any | null>(null);
  const [failureTesting, setFailureTesting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hospRes, metRes, auditRes, ehrModeRes] = await Promise.all([
        fetch("/api/hospitals").catch(() => null),
        fetch("/api/metrics").catch(() => null),
        fetch("/api/audit").catch(() => null),
        fetch("/api/ehr/simulate-failure").catch(() => null),
      ]);

      const hospData = hospRes && hospRes.ok ? await hospRes.json().catch(() => []) : [];
      const metData = metRes && metRes.ok ? await metRes.json().catch(() => null) : null;
      const auditData = auditRes && auditRes.ok ? await auditRes.json().catch(() => []) : [];
      const ehrModeData = ehrModeRes && ehrModeRes.ok ? await ehrModeRes.json().catch(() => ({})) : {};

      setHospitals(Array.isArray(hospData) ? hospData : []);
      setMetrics(metData && typeof metData === "object" && !metData.error ? metData : null);
      setAuditEvents(Array.isArray(auditData) ? auditData : []);
      if (ehrModeData && ehrModeData.mode) setSelectedFailureMode(ehrModeData.mode);
    } catch (err) {
      console.error(err);
      setHospitals([]);
      setAuditEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHospitalStatus = async (hospitalId: string, status: string) => {
    try {
      await fetch("/api/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId, status }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTraceLookup = async (corrId?: string) => {
    const idToLookup = corrId || searchCorrId;
    if (!idToLookup) return;
    setTraceLoading(true);
    try {
      const res = await fetch(`/api/audit?correlationId=${idToLookup}`);
      const data = await res.json();
      setTraceData(data);
      setSearchCorrId(idToLookup);
    } catch (err) {
      console.error(err);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleTriggerFailureDemo = async (mode: string) => {
    setFailureTesting(true);
    setFailureResult(null);
    try {
      // 1. Set mode
      await fetch("/api/ehr/simulate-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setSelectedFailureMode(mode);

      // 2. Trigger test booking through capability execute
      const testCorrId = `demo-fail-${Date.now().toString(36)}`;
      const bookRes = await fetch("/api/capabilities/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: "create_appointment",
          params: {
            doctorId: "doc-test", // Will resolve to first doctor in service
            patientId: "pat-test",
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 86400000 + 1800000).toISOString(),
            type: "IN_PERSON",
          },
          correlationId: testCorrId,
        }),
      });

      const bookData = await bookRes.json();
      setFailureResult({ mode, correlationId: testCorrId, result: bookData });
      await fetchData();
      handleTraceLookup(testCorrId);
    } catch (err: any) {
      setFailureResult({ error: err.message });
    } finally {
      setFailureTesting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xl">
            <ShieldCheck className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Platform Governance & Trace Operations</h1>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-tenant hospital onboarding approval, end-to-end correlation ID traces, and EHR failure recovery verification.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("APPLICATIONS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "APPLICATIONS"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Hospital Onboarding Lifecycle</span>
        </button>

        <button
          onClick={() => setActiveTab("TRACES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "TRACES"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Correlation ID Trace Explorer</span>
        </button>

        <button
          onClick={() => setActiveTab("FAILURES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "FAILURES"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>EHR Failure Recovery Simulator (PRD Sec 28)</span>
        </button>

        <button
          onClick={() => setActiveTab("METRICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "METRICS"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System & AI Performance</span>
        </button>
      </div>

      {/* TAB 1: HOSPITAL ONBOARDING LIFECYCLE (PRD Section 5) */}
      {activeTab === "APPLICATIONS" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Hospital Registration & Onboarding Lifecycle</h2>
            <p className="text-xs text-slate-500">
              Only APPROVED hospitals can publish doctor availability, receive appointments, and activate EHR integrations.
            </p>
          </div>

          <div className="space-y-3">
            {(Array.isArray(hospitals) ? hospitals : []).map((hosp) => (
              <div
                key={hosp.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{hosp.name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        hosp.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : hosp.status === "UNDER_REVIEW"
                          ? "bg-amber-100 text-amber-800 animate-pulse"
                          : hosp.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {hosp.status}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {hosp.address} • {hosp.phone} • {hosp.email}
                  </div>
                  {hosp.reviewNotes && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      Notes: {hosp.reviewNotes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {hosp.status !== "APPROVED" && (
                    <button
                      onClick={() => handleHospitalStatus(hosp.id, "APPROVED")}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Hospital</span>
                    </button>
                  )}

                  {hosp.status === "APPROVED" && (
                    <button
                      onClick={() => handleHospitalStatus(hosp.id, "SUSPENDED")}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition"
                    >
                      Suspend
                    </button>
                  )}

                  {hosp.status === "UNDER_REVIEW" && (
                    <button
                      onClick={() => handleHospitalStatus(hosp.id, "REJECTED")}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CORRELATION ID TRACE EXPLORER (PRD Section 19) */}
      {activeTab === "TRACES" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">End-to-End Correlation Trace Explorer</h2>
              <p className="text-xs text-slate-500">
                Trace a patient request seamlessly across: Conversation &rarr; AI Decision &rarr; Capability &rarr; Scheduling &rarr; EHR &rarr; Verification &rarr; Synchronization &rarr; Workflow &rarr; Notification.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchCorrId}
                onChange={(e) => setSearchCorrId(e.target.value)}
                placeholder="Enter Correlation ID (e.g. ai-conv-..., cap-..., demo-...)"
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                onClick={() => handleTraceLookup()}
                disabled={traceLoading || !searchCorrId}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>Lookup Trace</span>
              </button>
            </div>

            {/* Recent Correlation IDs Chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
              <span className="text-slate-500 font-semibold text-[11px]">Recent Correlation IDs:</span>
              {Array.from(new Set((Array.isArray(auditEvents) ? auditEvents : []).map((a) => a.correlationId)))
                .slice(0, 5)
                .map((id) => (
                  <button
                    key={id}
                    onClick={() => handleTraceLookup(id)}
                    className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded font-mono text-[11px] border border-purple-200 transition"
                  >
                    {id}
                  </button>
                ))}
            </div>
          </div>

          {/* Trace Results View */}
          {traceLoading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              Retrieving execution trace records...
            </div>
          ) : traceData ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="font-bold text-sm text-slate-900">
                  Trace for: <span className="font-mono text-purple-600">{traceData.correlationId}</span>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold">
                  Complete Execution Record
                </span>
              </div>

              {/* Sequential Execution Timeline */}
              <div className="space-y-4">
                {/* 1. Capability Executions */}
                {traceData.capabilityExecutions?.map((cap: any) => (
                  <div key={cap.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-sky-600" />
                        <span className="font-bold text-slate-900 font-mono">
                          Capability: {cap.capabilityName}()
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{cap.latencyMs}ms</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-slate-500 font-semibold mb-1">Input:</div>
                        <pre className="overflow-x-auto">{cap.inputPayload}</pre>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-slate-500 font-semibold mb-1">Output:</div>
                        <pre className="overflow-x-auto">{cap.outputPayload}</pre>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. EHR Integration Operations */}
                {traceData.integrationOperations?.map((op: any) => (
                  <div key={op.id} className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-blue-900 font-mono">
                          EHR Connector: {op.operationType}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : op.status === "RETRIED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {op.status}
                      </span>
                    </div>
                    {op.errorDetails && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-100">
                        {op.errorDetails}
                      </div>
                    )}
                  </div>
                ))}

                {/* 3. Notifications */}
                {traceData.notifications?.map((notif: any) => (
                  <div key={notif.id} className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Notification Dispatched: {notif.subject}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">{notif.channel}</span>
                    </div>
                    <div className="text-emerald-800 text-[11px]">{notif.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              Select or enter a Correlation ID above to view the full execution pipeline.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EHR FAILURE RECOVERY SIMULATOR (PRD Section 28) */}
      {activeTab === "FAILURES" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              PRD Section 28: Required Failure Demonstration & Safe Recovery
            </h2>
            <p className="text-xs text-slate-500">
              Test how the platform handles real-world distributed system faults without creating double bookings or losing state.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option A Card */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
                    Option A
                  </span>
                  <h3 className="font-bold text-xs text-slate-900">EHR Timeout & Retry</h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Booking &rarr; EHR Timeout (504) &rarr; Failure Classification &rarr; Idempotent Retry &rarr; External Verification &rarr; Confirmed.
                </p>
              </div>

              <button
                onClick={() => handleTriggerFailureDemo("TIMEOUT")}
                disabled={failureTesting}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
              >
                {failureTesting && selectedFailureMode === "TIMEOUT" ? "Simulating..." : "Test Option A Flow"}
              </button>
            </div>

            {/* Option B Card */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold text-[10px]">
                    Option B
                  </span>
                  <h3 className="font-bold text-xs text-slate-900">Unknown Outcome Recovery</h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Booking Sent &rarr; Network Hangup &rarr; Unknown Result &rarr; Query EHR directly &rarr; Record Found &rarr; Sync without Duplicate.
                </p>
              </div>

              <button
                onClick={() => handleTriggerFailureDemo("UNKNOWN_OUTCOME")}
                disabled={failureTesting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
              >
                {failureTesting && selectedFailureMode === "UNKNOWN_OUTCOME" ? "Simulating..." : "Test Option B Flow"}
              </button>
            </div>

            {/* Option C Card */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                    Option C
                  </span>
                  <h3 className="font-bold text-xs text-slate-900">Unrecoverable & Escalation</h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  EHR Outage (503) &rarr; Retries Exhausted &rarr; Reconciliation Record Created &rarr; Operator Alert & Human Escalation.
                </p>
              </div>

              <button
                onClick={() => handleTriggerFailureDemo("OUTAGE")}
                disabled={failureTesting}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
              >
                {failureTesting && selectedFailureMode === "OUTAGE" ? "Simulating..." : "Test Option C Flow"}
              </button>
            </div>
          </div>

          {/* Demonstration Output */}
          {failureResult && (
            <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-2 text-xs font-mono">
              <div className="text-purple-400 font-bold flex items-center justify-between">
                <span>Simulation Result: {failureResult.mode}</span>
                <span className="text-slate-400">Corr ID: {failureResult.correlationId}</span>
              </div>
              <pre className="overflow-x-auto text-[11px] max-h-48">
                {JSON.stringify(failureResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SYSTEM & AI PERFORMANCE (PRD Section 18 & 19) */}
      {activeTab === "METRICS" && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-extrabold text-slate-900">{metrics.totalAppointments}</div>
              <div className="text-xs text-slate-500 mt-1">Total Appointments</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-extrabold text-emerald-600">{metrics.confirmedAppointments}</div>
              <div className="text-xs text-slate-500 mt-1">Confirmed & Verified</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-extrabold text-sky-600">{metrics.avgLatencyMs}ms</div>
              <div className="text-xs text-slate-500 mt-1">Avg AI Voice Turn Latency (&lt;2s)</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-extrabold text-purple-600">{metrics.capabilityCalls}</div>
              <div className="text-xs text-slate-500 mt-1">Capability Invocations</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}