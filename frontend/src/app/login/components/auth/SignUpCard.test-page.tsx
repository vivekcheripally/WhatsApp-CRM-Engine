"use client";

import React, { useState } from "react";
import { SignUpCard } from "./SignUpCard";

/**
 * Test page for SignUpCard component
 * Allows visual testing and manual validation of the component
 */
export default function SignUpCardTestPage() {
  const [isActive, setIsActive] = useState(true);

  const handleModeSwitch = () => {
    console.log('Mode switch requested');
    alert('Mode switch would happen here');
  };

  const handleSignUpSuccess = (email: string) => {
    console.log('Sign up success for email:', email);
    alert(`Sign up success! Email: ${email}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ede5ff] via-[#e0d4fc] to-[#d5ccff] p-8 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/90 rounded-[24px] border border-violet-200/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(124,58,237,0.12)]">
        <SignUpCard
          isActive={isActive}
          onModeSwitch={handleModeSwitch}
          animationDirection="enter"
          onSignUpSuccess={handleSignUpSuccess}
        />
      </div>
    </div>
  );
}
