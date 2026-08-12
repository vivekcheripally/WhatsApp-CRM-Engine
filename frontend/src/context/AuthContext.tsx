"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { setAccessToken } from "@/lib/api";
import { User, OrganizationInfo, UserRole } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  permissions: string[];
  assigned_channels: string[];
  organization: OrganizationInfo | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  revokeAllSessions: () => Promise<void>;
  forceChangePassword: (newPassword: string, confirmPassword: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      // First try silent refresh to populate in-memory AccessToken
      try {
        const refreshRes = await api.post("/api/auth/refresh");
        if (refreshRes.data?.access_token) {
          setAccessToken(refreshRes.data.access_token);
        }
      } catch {
        // If silent refresh fails on initial load, proceed to check /me (or let catch block handle unauth)
      }

      const res = await api.get("/api/auth/me");
      const userData: User = res.data;
      setUser(userData);

      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        if (!userData.must_change_password) {
          if (userData.role === "SYSTEM_ADMIN" || userData.role === "super_admin") {
            router.push("/super-admin");
          } else {
            router.push("/");
          }
        }
      }
    } catch {
      clearTenantStorage();
      setAccessToken(null);
      setUser(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        router.push("/login");
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
      localStorage.removeItem("jwt");
      localStorage.removeItem("active_waba_account_id");
      localStorage.removeItem("whatsapp-settings-draft");
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    clearTenantStorage();
    const res = await api.post("/api/auth/login", {
      email,
      password,
      remember_me: rememberMe,
    });

    if (res.data.access_token) {
      setAccessToken(res.data.access_token);
    }

    const userData: User = res.data.user;
    setUser(userData);

    if (!userData.must_change_password) {
      if (userData.role === "SYSTEM_ADMIN" || userData.role === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push("/");
      }
    }
  };

  const forceChangePassword = async (newPassword: string, confirmPassword: string) => {
    const res = await api.post("/api/auth/force-change-password", {
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    const updatedUser = res.data.user;
    if (updatedUser) {
      setUser(updatedUser);
    } else {
      await checkAuth();
    }
    if (user?.role === "SYSTEM_ADMIN" || user?.role === "super_admin") {
      router.push("/super-admin");
    } else {
      router.push("/");
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      clearTenantStorage();
      setUser(null);
      router.push("/login");
    }
  };

  const revokeAllSessions = async () => {
    try {
      await api.post("/api/auth/revoke-all");
    } catch {
      // Ignore errors on session revocation
    } finally {
      setAccessToken(null);
      clearTenantStorage();
      setUser(null);
      router.push("/login");
    }
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
        revokeAllSessions,
        forceChangePassword,
        refreshAuth: checkAuth,
        isLoading,
      }}
    >
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
