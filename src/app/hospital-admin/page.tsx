"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Stethoscope, 
  Clock, 
  FileText, 
  Settings, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  RefreshCw,
  Users
} from "lucide-react";

export default function HospitalAdminPortal() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [hospitalData, setHospitalData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    try {
      const res = await fetch("/api/hospitals?status=APPROVED");
      const data = await res.json();
      setHospitals(data);
      if (data.length > 0) {
        setSelectedHospitalId(data[0].id);
        setHospitalData(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalChange = (id: string) => {
    setSelectedHospitalId(id);
    const found = hospitals.find((h) => h.id === id);
    setHospitalData(found);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xl">
            <Building2 className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Hospital Administration</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                Approved Tenant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure clinical departments, provider rosters, calendars, and healthcare-system integrations.
            </p>
          </div>
        </div>

        {/* Tenant Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Active Tenant:</span>
          <select
            value={selectedHospitalId}
            onChange={(e) => handleHospitalChange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !hospitalData ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          Loading hospital configurations...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Doctors & Departments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Doctors Roster */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <h2 className="font-bold text-sm text-slate-900">Physicians & Staff Roster</h2>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                  {hospitalData.doctors?.length || 0} Physicians
                </span>
              </div>

              <div className="space-y-3">
                {hospitalData.doctors?.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                      <div className="text-slate-500 mt-0.5">
                        {doc.specialty?.name} • {doc.qualifications}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        External Provider ID: {doc.externalProviderId || "None"}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {doc.status}
                      </span>
                      <div className="text-[11px] text-slate-500">{doc.durationMinutes} min slots</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Departments */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <h2 className="font-bold text-sm text-slate-900">Clinical Departments</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {hospitalData.departments?.map((dept: any) => (
                  <div key={dept.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">{dept.name}</div>
                    <div className="text-slate-500 text-[11px] leading-snug">{dept.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: Facility Settings & EHR Integration */}
          <div className="space-y-6">
            {/* Hospital Facility Profile */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                Hospital Profile
              </h3>
              <div className="space-y-2 text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Facility:</span> {hospitalData.name}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Address:</span> {hospitalData.address}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Contact:</span> {hospitalData.phone}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Email:</span> {hospitalData.email}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Tenant Status:</span>{" "}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    {hospitalData.status}
                  </span>
                </div>
              </div>
            </div>

            {/* EHR Connector Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
                <Settings className="w-4 h-4 text-amber-600" />
                <span>Healthcare EHR Connector</span>
              </div>

              {hospitalData.integrationConfig ? (
                <div className="space-y-2">
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[10px] overflow-x-auto">
                    <pre>{JSON.stringify(JSON.parse(hospitalData.integrationConfig), null, 2)}</pre>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-medium pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>External EHR Verification Enforced</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">No integration configuration specified.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}