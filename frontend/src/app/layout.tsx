"use client";

import "./globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { Providers } from "../components/providers";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthProvider } from "@/context/AuthContext";
import { WabaProvider } from "@/context/WabaContext";

import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

import FirstLoginPasswordModal from "../components/auth/FirstLoginPasswordModal";

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isAuthPage = pathname === "/login" || pathname.startsWith("/super-admin");
  const isInbox =
    pathname === "/whatsapp" ||
    pathname.startsWith("/whatsapp/inbox");

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {children}
        <FirstLoginPasswordModal />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-400">Loading FastSales...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main
          className={isInbox ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto"}
          style={isInbox ? {} : { background: "#f0f2ff" }}
        >
          {children}
        </main>
      </div>
      <FirstLoginPasswordModal />
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-background">
        <Providers>
          <AuthProvider>
            <WabaProvider>
              <AppShell>{children}</AppShell>
            </WabaProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}