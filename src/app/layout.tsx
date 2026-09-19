import type { Metadata } from "next";
import "./globals.css";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export const metadata: Metadata = {
  title: "AuraCare Health: Autonomous Multi-Hospital Patient Intake & AI Voice Platform",
  description:
    "Multi-tenant healthcare discovery, real availability scheduling, external EHR verification, and clinical pre-visit intake platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <RoleSwitcher />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
          AuraCare Healthcare Access Platform — Multi-Tenant AI Intake, Central Scheduling & EHR Connector Engine
        </footer>
      </body>
    </html>
  );
}