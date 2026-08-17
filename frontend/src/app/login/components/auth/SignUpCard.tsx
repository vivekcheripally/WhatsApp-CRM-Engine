"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { FormField } from "./FormField";
import {
  validateSignUpForm,
  validateName,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  SignUpFormData,
  SignUpFormErrors,
} from "../../utils/validation";

/**
 * SignUpCard Component
 * 
 * Renders the sign-up form with name, email, password, and confirm password fields.
 * Handles form validation, submission, and registration API calls.
 * 
 * Requirements: 3.1-3.5, 6.1-6.10, 8.1-8.7, 11.1-11.5, 13.1-13.4, 15.1-15.4, 19.1-19.5, 20.1-20.5
 */

interface SignUpCardProps {
  isActive: boolean;
  onModeSwitch: () => void;
  animationDirection: 'enter' | 'exit';
  onSignUpSuccess?: (email: string) => void;
}

const easeTuple: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SignUpCard: React.FC<SignUpCardProps> = ({
  isActive,
  onModeSwitch,
  animationDirection,
  onSignUpSuccess,
}) => {
  // Form data state
  const [formData, setFormData] = useState<SignUpFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Form errors state
  const [errors, setErrors] = useState<SignUpFormErrors>({});

  // Loading state
  const [loading, setLoading] = useState(false);

  // General error (API errors)
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Handle field value change
   * Clears error for the field when user starts typing
   * Requirement 13.4: Clear errors when user corrects fields
   */
  const handleFieldChange = (field: keyof SignUpFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Clear general error when user makes changes
    if (generalError) {
      setGeneralError(null);
    }
  };

  /**
   * Handle field blur event
   * Validates individual field on blur
   * Requirement 14.3: Validate fields on blur event
   */
  const handleFieldBlur = (field: keyof SignUpFormData) => {
    let error: string | undefined;

    switch (field) {
      case 'name':
        error = validateName(formData.name);
        break;
      case 'email':
        error = validateEmail(formData.email);
        break;
      case 'password':
        error = validatePassword(formData.password);
        break;
      case 'confirmPassword':
        error = validatePasswordMatch(formData.password, formData.confirmPassword);
        break;
    }

    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  /**
   * Check if form has any validation errors
   * Requirement 20.1, 20.2: Disable submit button when form has errors
   */
  const hasErrors = (): boolean => {
    return Object.keys(errors).length > 0 || 
           !formData.name || 
           !formData.email || 
           !formData.password || 
           !formData.confirmPassword;
  };

  /**
   * Handle form submission
   * Requirements 8.1-8.7: Registration submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setGeneralError(null);
    setSuccessMessage(null);

    // Validate entire form before submission
    const validationErrors = validateSignUpForm(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Set loading state (Requirements 8.2, 8.3)
    setLoading(true);

    try {
      // Make POST request to registration endpoint
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error case (Requirement 8.6)
        throw new Error(data.detail || 'Registration failed. Please try again.');
      }

      // Handle success case (Requirements 8.4, 8.5, 19.1-19.5)
      setSuccessMessage('Account created successfully! Redirecting to sign in...');
      
      // Clear form data
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });

      // Auto-switch to sign-in mode after 1.5 seconds with pre-filled email
      setTimeout(() => {
        if (onSignUpSuccess) {
          onSignUpSuccess(formData.email);
        }
      }, 1500);

    } catch (err: unknown) {
      // Handle error case (Requirement 8.6, 8.7)
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred. Please try again.';
      setGeneralError(errorMessage);
    } finally {
      // Re-enable form after completion (Requirement 15.4)
      setLoading(false);
    }
  };

  /**
   * Handle Enter key press
   * Requirement 20.4: Enter key submits valid forms
   * Requirement 20.5: Enter key prevented on invalid forms
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !hasErrors() && !loading) {
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="p-8 sm:p-12 flex flex-col justify-center relative z-10">
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-3xl font-extrabold text-slate-900 tracking-wider mb-8"
      >
        Sign Up
      </motion.h1>

      {/* Success Message Banner (Requirement 8.5) */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: easeTuple }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center space-x-2 text-green-700 text-xs">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-4 h-4 flex-shrink-0" />
              </motion.div>
              <span>{successMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner (Requirements 8.6, 13.1-13.3) */}
      <AnimatePresence>
        {generalError && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: easeTuple }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign Up Form */}
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        {/* Name Field (Requirements 3.1, 6.1-6.2) */}
        <FormField
          type="text"
          label="Name"
          value={formData.name}
          onChange={(value) => handleFieldChange('name', value)}
          onBlur={() => handleFieldBlur('name')}
          error={errors.name}
          placeholder="John Doe"
          icon={User}
          required
          autoComplete="name"
        />

        {/* Email Field (Requirements 3.1, 6.3) */}
        <FormField
          type="email"
          label="Email"
          value={formData.email}
          onChange={(value) => handleFieldChange('email', value)}
          onBlur={() => handleFieldBlur('email')}
          error={errors.email}
          placeholder="john@example.com"
          icon={Mail}
          required
          autoComplete="email"
        />

        {/* Password Field (Requirements 3.1, 3.3, 6.4-6.8) */}
        <FormField
          type="password"
          label="Password"
          value={formData.password}
          onChange={(value) => handleFieldChange('password', value)}
          onBlur={() => handleFieldBlur('password')}
          error={errors.password}
          placeholder="••••••••••••"
          icon={Lock}
          showPasswordToggle
          required
          autoComplete="new-password"
        />

        {/* Confirm Password Field (Requirements 3.1, 3.3, 6.9) */}
        <FormField
          type="password"
          label="Confirm Password"
          value={formData.confirmPassword}
          onChange={(value) => handleFieldChange('confirmPassword', value)}
          onBlur={() => handleFieldBlur('confirmPassword')}
          error={errors.confirmPassword}
          placeholder="••••••••••••"
          icon={Lock}
          showPasswordToggle
          required
          autoComplete="new-password"
        />

        {/* Submit Button (Requirements 3.4, 8.2, 8.3, 15.1, 15.2, 20.1, 20.2) */}
        <div className="pt-4">
          <motion.button
            type="submit"
            disabled={loading || hasErrors()}
            whileHover={!loading && !hasErrors() ? { scale: 1.02, boxShadow: "0 10px 30px rgba(124, 58, 237, 0.4)" } : {}}
            whileTap={!loading && !hasErrors() ? { scale: 0.98 } : {}}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            className="w-full py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 hover:from-violet-500 hover:to-indigo-500 shadow-[0_8px_25px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-violet-400/20 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <span>Sign Up</span>
            )}
          </motion.button>
        </div>
      </form>

      {/* Footer Link (Requirement 3.5) */}
      <div className="mt-8 text-center text-xs text-slate-500">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onModeSwitch}
          disabled={loading}
          className="text-violet-600 hover:text-violet-700 hover:underline font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
