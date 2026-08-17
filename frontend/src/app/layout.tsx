"use client";

import "./globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { Providers } from "../components/providers";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AuthProvider } from "@/context/AuthContext";
import { WabaProvider } from "@/context/WabaContext";
import { useCurrentUser } from "@/hooks/use-current-user";

function AppShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading } = useCurrentUser();

  const isAuthPage = pathname === "/login";
  const isSuperAdminPage = pathname.startsWith("/super-admin");
  const isInbox = pathname === "/whatsapp" || pathname.startsWith("/whatsapp/inbox");

  useEffect(() => {
    // Wait until auth state is resolved and user is confirmed logged in
    if (isLoading || !user) return;

    const isSuperAdmin = role === "SYSTEM_ADMIN" || role === "super_admin";
    const isSalesAgent = role === "SALES_AGENT";

    // 1. Super Admin Route Protection
    if (isSuperAdmin && !isSuperAdminPage && !isAuthPage) {
      router.replace("/super-admin");
      return;
    }
    if (!isSuperAdmin && isSuperAdminPage) {
      router.replace("/");
      return;
    }

    // 2. Sales Agent Route Protection (forbidden: reports, activity, agents, whatsapp/settings)
    if (isSalesAgent) {
      const forbiddenRoutes = ["/reports", "/activity", "/agents", "/whatsapp/settings"];
      const isForbidden = forbiddenRoutes.some(
        (r) => pathname === r || pathname.startsWith(r + "/")
      );
      if (isForbidden) {
        router.replace("/whatsapp");
      }
    }
  }, [user, role, isLoading, pathname, router, isSuperAdminPage, isAuthPage]);

  // Auth page — render without shell
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Super-admin section — dark shell, no sidebar
  if (isSuperAdminPage) {
    return <div className="min-h-screen bg-slate-950 text-white">{children}</div>;
  }

  // Still resolving auth — show a neutral loader rather than redirecting
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
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
              <AppShellContent>{children}</AppShellContent>
            </WabaProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}