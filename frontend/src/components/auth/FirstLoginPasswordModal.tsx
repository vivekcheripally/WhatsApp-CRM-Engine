"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";

export default function FirstLoginPasswordModal() {
  const { user, forceChangePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If user doesn't exist or doesn't need to change password, don't render modal
  if (!user || !user.must_change_password) {
    return null;
  }

  // Password validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    if (!passwordsMatch) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await forceChangePassword(newPassword, confirmPassword);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white text-center relative">
          <div className="mx-auto w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-inner text-white">
            <KeyRound className="w-7 h-7 text-white mx-auto" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Create Your New Password</h2>
          <p className="text-xs text-indigo-100 mt-1 max-w-xs mx-auto">
            You are logging in with a temporary password. Please set a new password to secure your account.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start space-x-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs space-y-1.5 text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">Password Requirements:</p>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={hasMinLength ? "text-slate-200" : "text-slate-500"}>At least 8 characters</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter && hasNumber ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={hasLetter && hasNumber ? "text-slate-200" : "text-slate-500"}>Contains both letters and numbers</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={passwordsMatch ? "text-slate-200" : "text-slate-500"}>Passwords match</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !hasMinLength || !hasLetter || !hasNumber || !passwordsMatch}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <span>Saving New Password...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Save Password & Continue</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
