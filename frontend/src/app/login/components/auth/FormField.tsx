"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, LucideIcon } from "lucide-react";

export interface FormFieldProps {
  type: "text" | "email" | "password";
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  icon?: LucideIcon;
  showPasswordToggle?: boolean;
  required?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
}

const easeTuple: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const FormField: React.FC<FormFieldProps> = ({
  type,
  label,
  value,
  onChange,
  error,
  placeholder,
  icon: Icon,
  showPasswordToggle = false,
  required = false,
  autoComplete,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputType = type === "password" && showPasswordToggle && showPassword ? "text" : type;

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-xs text-slate-600 font-semibold tracking-wider uppercase">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>

      {/* Input Container */}
      <div
        className={`relative border-b transition-colors group ${
          error
            ? "border-rose-500"
            : isFocused
            ? "border-violet-600"
            : "border-slate-200"
        }`}
      >
        {/* Animated Focus Indicator */}
        <span
          className={`absolute bottom-0 left-0 h-[2px] bg-violet-600 transition-all duration-300 shadow-[0_0_12px_rgba(124,58,237,0.4)] ${
            isFocused ? "w-full" : "w-0"
          }`}
        />

        {/* Input Field */}
        <input
          type={inputType}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (onBlur) onBlur();
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full bg-transparent py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none ${
            showPasswordToggle && Icon ? "pr-14" : Icon ? "pr-8" : "pr-2"
          }`}
        />

        {/* Right Side Icons */}
        <div className="absolute right-1 top-2.5 flex items-center space-x-1.5 text-slate-400">
          {/* Password Toggle Button */}
          {showPasswordToggle && type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-violet-600 transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Field Icon */}
          {Icon && (
            <Icon
              className={`w-4 h-4 pointer-events-none transition-colors ${
                isFocused ? "text-violet-600" : "text-slate-400"
              }`}
            />
          )}
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: easeTuple }}
            className="overflow-hidden"
          >
            <div className="flex items-start space-x-2 text-rose-600 text-xs mt-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
