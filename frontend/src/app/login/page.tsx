"use client";

import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, Loader2, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SplashScreen from "./components/SplashScreen";

import api from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "change_password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [targetRoute, setTargetRoute] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "login") {
      try {
        const userData = await login(email, password, false);
        let route = "/whatsapp/settings";
        if (userData.role === "SYSTEM_ADMIN" || userData.role === "super_admin") {
          route = "/super-admin";
        }
        setTargetRoute(route);

        if (userData.must_change_password) {
          setMode("change_password");
          setLoading(false);
          return;
        }

        setShowSplash(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Invalid credentials.");
        setLoading(false);
      }
    } else if (mode === "change_password") {
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        setLoading(false);
        return;
      }
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters long.");
        setLoading(false);
        return;
      }
      if (newPassword === password) {
        setError("New password must be different from current temporary password.");
        setLoading(false);
        return;
      }
      try {
        await api.post("/api/auth/change-password", {
          current_password: password,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
        setSuccess("Password changed successfully!");
        setTimeout(() => {
          setShowSplash(true);
        }, 1000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to change password.");
        setLoading(false);
      }
    } else {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Registration failed.");
        setSuccess("Account created successfully!");
        setTimeout(() => {
          setMode("login");
          setSuccess(null);
          setLoading(false);
        }, 1500);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Registration failed.");
        setLoading(false);
      }
    }
  };


  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 bg-[#15052a]">
        <SplashScreen onComplete={() => router.push(targetRoute)} logoSrc="/fastsales-logo.svg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans text-slate-800">
      {/* ══ LEFT PANEL — Form Section ══ */}
      <div className="w-full lg:w-[48%] xl:w-[45%] min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-white relative">
        {/* Header / Brand Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-md shadow-purple-500/20"
            style={{ background: "#7C3AED" }}
          >
            {/* Battery / Pill icon as in design */}
            <svg
              className="w-4 h-4 fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="4" y="7" width="13" height="10" rx="2.5" fill="currentColor" opacity="0.95" />
              <rect x="7.5" y="9.5" width="6" height="5" rx="1" fill="#7C3AED" />
              <path
                d="M19 10C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14V10Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="font-black text-xl tracking-wider text-slate-900 uppercase">
            NEXORA
          </span>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-6">
          {/* Main Title & Subtitle */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-[1.18] tracking-tight">
              {mode === "login" ? (
                <>
                  Holla,<br />
                  Welcome Back
                </>
              ) : mode === "change_password" ? (
                <>
                  Security,<br />
                  Change Password
                </>
              ) : (
                <>
                  Join Us,<br />
                  Create Account
                </>
              )}
            </h1>
            <p className="mt-3 text-slate-400 text-sm font-medium">
              {mode === "login"
                ? "Hey, welcome back to your special place"
                : mode === "change_password"
                ? "First login detected. Please create a new password to activate your account."
                : "Hey, sign up to explore your special place"}
            </p>
          </div>

          {/* Alert messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode !== "change_password" ? (
              <>
                {/* Email Field - Soft light blue pill background */}
                <div>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nimisha@gmail.com"
                      className="w-full px-5 py-3.5 rounded-2xl text-sm bg-[#EEF4FF] text-slate-800 border-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Field - Soft light blue pill background */}
                <div>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-5 py-3.5 rounded-2xl text-sm bg-[#EEF4FF] text-slate-800 border-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-purple-700 transition-colors z-10 p-1 rounded-full hover:bg-purple-100/60"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="w-5 h-5 stroke-[2]" /> : <Eye className="w-5 h-5 stroke-[2]" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Change password fields */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 px-1">
                    Log In Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-5 py-3 rounded-2xl text-sm bg-slate-100 text-slate-500 border-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 px-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-5 py-3.5 rounded-2xl text-sm bg-[#EEF4FF] text-slate-800 border-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-purple-700 transition-colors z-10 p-1 rounded-full hover:bg-purple-100/60"
                      aria-label={showNewPw ? "Hide password" : "Show password"}
                    >
                      {showNewPw ? <EyeOff className="w-5 h-5 stroke-[2]" /> : <Eye className="w-5 h-5 stroke-[2]" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 px-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPw ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-5 py-3.5 rounded-2xl text-sm bg-[#EEF4FF] text-slate-800 border-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                  />
                </div>
              </>
            )}

            {/* Checkbox and Forgot Password Row */}
            {mode === "login" && (
              <div className="flex items-center justify-between pt-1 px-1">
                <label
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setRemember(!remember)}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                      remember
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "border border-slate-300 bg-white"
                    }`}
                  >
                    {remember && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-slate-600">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => alert("Password reset instructions have been sent.")}
                  className="text-xs sm:text-sm font-medium text-slate-400 hover:text-purple-600 transition-colors"
                >
                  Forget Password?
                </button>
              </div>
            )}

            {/* Sign In Button - Full width violet pill */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
              style={{
                background: "#7C3AED",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                "Sign In"
              ) : mode === "change_password" ? (
                "Update Password & Continue"
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          {/* Footer toggle text */}
          {mode !== "change_password" && (
            <div className="mt-8 text-center text-xs sm:text-sm font-medium text-slate-400">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="font-bold text-purple-600 hover:text-purple-700 transition-colors ml-0.5"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="font-bold text-purple-600 hover:text-purple-700 transition-colors ml-0.5"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer spacing */}
        <div className="h-4" />
      </div>

      {/* ══ RIGHT PANEL — Full Bleed Image filling entire right side with no empty space ══ */}
      <div className="w-full lg:w-[52%] xl:w-[55%] min-h-[450px] lg:min-h-screen relative overflow-hidden">
        <Image
          src="/login-illustration.png"
          alt="NEXORA WhatsApp CRM Platform"
          fill
          priority
          quality={100}
          unoptimized
          className="object-cover object-center w-full h-full"
        />
      </div>
    </div>
  );
}



