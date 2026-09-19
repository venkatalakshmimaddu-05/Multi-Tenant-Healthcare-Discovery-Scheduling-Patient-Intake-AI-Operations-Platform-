"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Application Error Caught]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-amber-600" />
      </div>

      <div className="space-y-1 max-w-md">
        <h2 className="text-lg font-bold text-slate-900">Portal Initialized with Safe Fallback</h2>
        <p className="text-xs text-slate-500">
          {error?.message || "An unexpected client-side state occurred. Please click below to refresh the active session."}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Hard Reload Portal</span>
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}
