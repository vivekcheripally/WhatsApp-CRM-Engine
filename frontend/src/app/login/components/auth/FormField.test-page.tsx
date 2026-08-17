"use client";

import React, { useState } from "react";
import { FormField } from "./FormField";
import { User, Lock, Mail } from "lucide-react";

/**
 * Test page for FormField component
 * This demonstrates all the features of the FormField component
 */
export default function FormFieldTestPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Clear error when user starts typing
    if (emailError) {
      setEmailError(undefined);
    }
  };

  const simulateError = () => {
    setEmailError("Invalid email format");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ede5ff] via-[#e0d4fc] to-[#d5ccff] p-8">
      <div className="max-w-md mx-auto bg-white/90 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">
          FormField Component Test
        </h1>

        <div className="space-y-6">
          {/* Text Field with Icon */}
          <FormField
            type="text"
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="John Doe"
            icon={User}
            required
          />

          {/* Email Field with Icon and Error */}
          <FormField
            type="email"
            label="Email Address"
            value={email}
            onChange={handleEmailChange}
            error={emailError}
            placeholder="john@example.com"
            icon={Mail}
            required
          />

          {/* Password Field with Toggle */}
          <FormField
            type="password"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            icon={Lock}
            showPasswordToggle
            required
          />

          {/* Test Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={simulateError}
              className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600 transition-colors"
            >
              Simulate Email Error
            </button>
            <button
              onClick={() => setEmailError(undefined)}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm hover:bg-violet-600 transition-colors"
            >
              Clear Error
            </button>
          </div>

          {/* Current Values Display */}
          <div className="mt-8 p-4 bg-slate-100 rounded-lg">
            <h3 className="text-sm font-semibold mb-2 text-slate-700">
              Current Values:
            </h3>
            <pre className="text-xs text-slate-600">
              {JSON.stringify({ name, email, password }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
