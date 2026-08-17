"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { FormField } from "./FormField";
import { useAuth } from "@/context/AuthContext";
import {
  SignInFormData,
  SignInFormErrors,
  validateSignInForm,
  validateEmail,
} from "../../utils/validation";

/**
 * Props for the SignInCard component
 */
export interface SignInCardProps {
  /** Whether this card is currently active/visible */
  isActive: boolean;
  /** Callback to switch to sign-up mode */
  onModeSwitch: () => void;
  /** Animation direction (enter or exit) */
  animationDirection: "enter" | "exit";
  /** Optional pre-filled email (e.g. after a successful sign-up) */
  prefillEmail?: string;
}

const easeTuple: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * SignInCard Component
 * 
 * Renders the sign-in form with email and password fields.
 * Maintains existing functionality while adding animation support.
 * 
 * Requirements: 4.1-4.5, 7.1-7.4, 9.1-9.6, 11.1-11.5, 13.1-13.4, 15.1-15.4, 20.1-20.5
 */
export const SignInCard: React.FC<SignInCardProps> = ({
  isActive,
  onModeSwitch,
  animationDirection,
  prefillEmail,
}) => {
  const { login } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState<SignInFormData>({
    email: prefillEmail ?? "",
    password: "",
  });
  
  // Error state
  const [errors, setErrors] = useState<SignInFormErrors>({});
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // General error banner state
  const [generalError, setGeneralError] = useState<string | null>(null);

  /**
   * Handle field value changes
   * Clears errors when user starts typing (Requirement 13.4)
   */
  const handleFieldChange = (field: keyof SignInFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    
    // Clear general error when user starts correcting
    if (generalError) {
      setGeneralError(null);
    }
  };

  /**
   * Handle field blur events
   * Validates field on blur (Requirement 14.3)
   */
  const handleFieldBlur = (field: keyof SignInFormData) => {
    if (field === "email") {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        setErrors((prev) => ({ ...prev, email: emailError }));
      }
    } else if (field === "password") {
      if (!formData.password || formData.password.trim() === "") {
        setErrors((prev) => ({ ...prev, password: "Password is required" }));
      }
    }
  };

  /**
   * Handle form submission
   * Validates form, shows loading state, calls login API
   * Requirements: 9.1-9.6, 15.1-15.4
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setGeneralError(null);
    
    // Validate form before submission (Requirement 7.1-7.4)
    const validationErrors = validateSignInForm(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Set loading state (Requirements 9.2, 9.3, 15.1, 15.2)
    setIsLoading(true);
    
    try {
      // Call login from AuthContext (Requirement 9.1)
      await login(formData.email, formData.password);
      // Success case - redirect handled by AuthContext (Requirement 9.4)
    } catch (error: unknown) {
      // Handle error case (Requirements 9.5, 9.6, 13.1-13.3)
      const errorMessage = 
        error instanceof Error && 'response' in error
          ? "Failed to sign in. Please check your credentials."
          : "Failed to sign in. Please check your credentials.";
      
      setGeneralError(errorMessage);
      
      // Re-enable form for retry (Requirements 9.6, 15.4)
      setIsLoading(false);
    }
  };

  /**
   * Check if form has validation errors
   * Used to disable submit button (Requirements 20.1, 20.2)
   */
  const hasErrors = () => {
    return Object.values(errors).some((error) => error !== undefined);
  };

  /**
   * Check if form is valid for submission
   * Requirements: 7.4, 20.1, 20.2, 20.5
   */
  const isFormValid = () => {
    return (
      formData.email.trim() !== "" &&
      formData.password.trim() !== "" &&
      !hasErrors() &&
      !isLoading
    );
  };

  return (
    <div className="p-8 sm:p-12 flex flex-col justify-center">
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-3xl font-extrabold text-slate-900 tracking-wider mb-8"
      >
        Sign In
      </motion.h1>

      {/* Error Banner - Animated (Requirements 13.1, 13.2, 13.3) */}
      <AnimatePresence>
        {generalError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: easeTuple }}
            className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-rose-700">{generalError}</p>
            </div>
            <button
              onClick={() => setGeneralError(null)}
              className="text-rose-400 hover:text-rose-600 transition-colors"
              aria-label="Dismiss error"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign In Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field - Requirements 4.1, 4.2, 11.3 */}
        <FormField
          type="email"
          label="Email Address"
          value={formData.email}
          onChange={(value) => handleFieldChange("email", value)}
          onBlur={() => handleFieldBlur("email")}
          error={errors.email}
          placeholder="you@example.com"
          icon={Mail}
          required
          autoComplete="email"
        />

        {/* Password Field - Requirements 4.3, 4.4, 17.1-17.5 */}
        <FormField
          type="password"
          label="Password"
          value={formData.password}
          onChange={(value) => handleFieldChange("password", value)}
          onBlur={() => handleFieldBlur("password")}
          error={errors.password}
          placeholder="Enter your password"
          icon={Lock}
          showPasswordToggle={true}
          required
          autoComplete="current-password"
        />

        {/* Submit Button - Requirements 9.2, 9.3, 15.1, 20.1, 20.2 */}
        <button
          type="submit"
          disabled={!isFormValid()}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 ${
            isFormValid()
              ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50"
              : "bg-slate-300 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center space-x-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Signing in...</span>
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Sign Up Link - Requirements 4.5, 1.1 */}
        <div className="text-center pt-2">
          <p className="text-sm text-slate-600">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onModeSwitch}
              disabled={isLoading}
              className={`font-semibold text-violet-600 hover:text-violet-700 transition-colors ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Sign Up
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
