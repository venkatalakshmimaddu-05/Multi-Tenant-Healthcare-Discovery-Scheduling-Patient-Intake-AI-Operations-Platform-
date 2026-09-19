import Link from "next/link";
import { 
  Radio, 
  User, 
  Stethoscope, 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Workflow, 
  Database,
  Cpu
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-sky-950 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-medium tracking-wide">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
            AI-Native Healthcare Access Platform with <span className="text-sky-400">Real Availability</span> & Verified EHR Integration
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
            Instead of navigating complex department silos, patients describe their requirements naturally by voice or phone. The platform discovers specialists, checks verified availability, executes atomic bookings, verifies external EHR records, and automates pre-visit clinical intake.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/patient/assistant"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold shadow-lg shadow-sky-500/25 transition"
            >
              <Radio className="w-5 h-5 animate-pulse text-white" />
              <span>Launch Voice & Phone Assistant</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/platform-admin"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition"
            >
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <span>Platform Admin & Traces</span>
            </Link>
          </div>
        </div>
      </div>

      {/* End-to-End Execution Flow (PRD Section 2) */}
      <div className="max-w-6xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">The Connected Execution Chain</h2>
          <p className="text-sm text-slate-600 mt-1">
            Demonstrating a true AI-native healthcare platform, not simply an unstructured chatbot.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              01
            </div>
            <div className="font-semibold text-slate-800 text-xs">Patient Voice / Phone</div>
            <div className="text-[11px] text-slate-500 mt-1">Natural request in speech or dial-in</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              02
            </div>
            <div className="font-semibold text-slate-800 text-xs">AI Context & NLU</div>
            <div className="text-[11px] text-slate-500 mt-1">Contextual pronoun & date resolution</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              03
            </div>
            <div className="font-semibold text-slate-800 text-xs">Real Availability</div>
            <div className="text-[11px] text-slate-500 mt-1">Doctor calendars & mutex locking</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              04
            </div>
            <div className="font-semibold text-slate-800 text-xs">EHR Integration</div>
            <div className="text-[11px] text-slate-500 mt-1">Pluggable adapter & verification loop</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              05
            </div>
            <div className="font-semibold text-slate-800 text-xs">Pre-Visit Intake</div>
            <div className="text-[11px] text-slate-500 mt-1">Structured clinical questionnaires</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
              06
            </div>
            <div className="font-semibold text-slate-800 text-xs">Doctor & Admin Trace</div>
            <div className="text-[11px] text-slate-500 mt-1">Correlation ID end-to-end tracing</div>
          </div>
        </div>

        {/* Portal Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
          {/* Patient Card */}
          <Link
            href="/patient/assistant"
            className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-sky-500 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Radio className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Voice & Phone Agent</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Experience real-time voice turns with turn-taking, barge-in, sub-2s latency, and telephone dial-in mode.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold text-sky-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>Start Voice Session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Doctor Card */}
          <Link
            href="/doctor"
            className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Stethoscope className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Doctor Portal</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Review appointments for Dr. Rao and Dr. Chen, inspect patient pre-visit intake questionnaires, and block surgical slots.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>View Doctor Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Hospital Admin Card */}
          <Link
            href="/hospital-admin"
            className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-amber-500 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Hospital Admin</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Manage doctor rosters, working hours, pre-visit questionnaire schemas, and EHR connector settings with tenant isolation.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>Manage Hospital</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Platform Admin Card */}
          <Link
            href="/platform-admin"
            className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-purple-500 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Platform Admin & Audit</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Approve hospital onboarding applications, view system health, test Option A/B/C EHR fault recovery, and explore correlation traces.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold text-purple-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              <span>Platform Operations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}