"use client";

import React, { useCallback, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { AnimatedLogo } from "./AnimatedLogo";

// ─── SplashScreen Props Interface ──────────────────────────────────────────

export interface SplashScreenProps {
  onComplete: () => void;
  logoSrc: string;
}

// ─── SplashScreen Component ────────────────────────────────────────────────

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  logoSrc,
}) => {
  const reduceMotion = useReducedMotion();
  const completionTriggered = useRef(false);

  // Handle animation completion and prevent duplicate calls
  const handleAnimationComplete = useCallback(() => {
    if (!completionTriggered.current) {
      completionTriggered.current = true;
      onComplete();
    }
  }, [onComplete]);

  return (
    <div
      className="w-screen h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(circle at 50% 50%, #6b21a8 0%, #3b0764 50%, #15052a 100%)",
        backgroundColor: "#3b0764",
      }}
      data-testid="splash-screen"
    >
      {/* Center the AnimatedLogo component */}
      <AnimatedLogo
        onAnimationComplete={handleAnimationComplete}
        reduceMotion={!!reduceMotion}
      />
    </div>
  );
};

export default SplashScreen;
