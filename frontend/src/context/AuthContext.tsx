"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { User, OrganizationInfo, UserRole } from "@/lib/types";

import SplashScreen from "@/app/login/components/SplashScreen";

interface AuthContextType {
  user: User | null;
  permissions: string[];
  assigned_channels: string[];
  organization: OrganizationInfo | null;
  login: (email: string, password: string, redirect?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      const res = await api.get("/api/auth/me");
      const userData: User = res.data;
      setUser(userData);

      // If we're sitting on /login and already authenticated, redirect away
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        if (userData.role === "SYSTEM_ADMIN" || userData.role === "super_admin") {
          router.replace("/super-admin");
        } else {
          router.replace("/whatsapp/settings");
        }
      }
    } catch {
      setUser(null);
      // Only redirect to /login if not already there (avoid reload loop)
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        router.replace("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const clearTenantStorage = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_waba_account_id");
      localStorage.removeItem("whatsapp-settings-draft");
    }
  };

  const login = async (email: string, password: string, redirect: boolean = true) => {
    clearTenantStorage();
    const res = await api.post("/api/auth/login", { email, password });
    const userData: User = res.data.user;
    setUser(userData);

    if (redirect) {
      if (userData.role === "SYSTEM_ADMIN" || userData.role === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push("/whatsapp/settings");
      }
    }
    return userData;
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      setShowSplash(true);
    }
  };

  const handleLogoutSplashComplete = () => {
    clearTenantStorage();
    setUser(null);
    setShowSplash(false);
    router.push("/login");
  };

  const permissions = user?.permissions || [];
  const assigned_channels = user?.assigned_channels || [];
  const organization = user?.organization || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        assigned_channels,
        organization,
        login,
        logout,
        isLoading,
      }}
    >
      {showSplash && (
        <div className="fixed inset-0 z-[9999] bg-[#15052a]">
          <SplashScreen onComplete={handleLogoutSplashComplete} logoSrc="/fastsales-logo.svg" />
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
