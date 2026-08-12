"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, X, CheckCircle2 } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError("New password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    if (!passwordsMatch) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to change password. Please verify your current password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Change Password</h3>
              <p className="text-xs text-slate-400">Update your account login password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start space-x-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs space-y-1 text-slate-400">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={hasMinLength ? "text-slate-200" : "text-slate-500"}>At least 8 characters</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter && hasNumber ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={hasLetter && hasNumber ? "text-slate-200" : "text-slate-500"}>Contains letters & numbers</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={passwordsMatch ? "text-slate-200" : "text-slate-500"}>Passwords match</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !hasMinLength || !hasLetter || !hasNumber || !passwordsMatch || !oldPassword}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-2"
            >
              {submitting ? (
                <span>Updating...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
