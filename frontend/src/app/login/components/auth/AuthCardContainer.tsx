"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SignInCard } from "./SignInCard";
import { SignUpCard } from "./SignUpCard";
import { AuthMode } from "../../types/auth";

/**
 * Props for the AuthCardContainer component
 */
export interface AuthCardContainerProps {
  /** Initial mode to display (defaults to 'signin') */
  initialMode?: AuthMode;
  /** Callback invoked when mode changes — used to sync branding panel heading */
  onModeChange?: (mode: AuthMode) => void;
}

/**
 * AuthCardContainer
 *
 * Manages sign-in / sign-up mode switching with a professional slide + fade
 * transition powered by Framer Motion AnimatePresence.
 *
 * Requirements: 1.1-1.5, 2.1-2.5, 5.1-5.5
 */
export const AuthCardContainer: React.FC<AuthCardContainerProps> = ({
  initialMode = "signin",
  onModeChange,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");

  /**
   * direction ref:
   *   signin → signup  : +1  (new card slides in from right, old slides out left)
   *   signup → signin  : -1  (new card slides in from left, old slides out right)
   */
  const directionRef = useRef<1 | -1>(1);

  /**
   * Switch between modes with a short lock to prevent double-triggers.
   * AnimatePresence mode="wait" handles the actual sequencing.
   */
  const handleModeSwitch = () => {
    if (isTransitioning) return;

    directionRef.current = mode === "signin" ? 1 : -1;
    setIsTransitioning(true);

    setTimeout(() => {
      const next: AuthMode = mode === "signin" ? "signup" : "signin";
      setMode(next);
      onModeChange?.(next);
      setIsTransitioning(false);
    }, 50);
  };

  /**
   * Called by SignUpCard on successful registration.
   * Pre-fills the email in SignInCard so the user can sign in immediately.
   */
  const handleSignUpSuccess = (email: string) => {
    setPrefillEmail(email);
    handleModeSwitch();
  };

  const d = directionRef.current;

  const variants = {
    initial: {
      opacity: 0,
      x: d * 50,
      scale: 0.97,
      filter: "blur(4px)",
    },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
    exit: {
      opacity: 0,
      x: d * -50,
      scale: 0.97,
      filter: "blur(4px)",
      transition: {
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <div className="w-full h-full flex flex-col justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
        >
          {mode === "signin" ? (
            <SignInCard
              isActive={true}
              onModeSwitch={handleModeSwitch}
              animationDirection="enter"
              prefillEmail={prefillEmail}
            />
          ) : (
            <SignUpCard
              isActive={true}
              onModeSwitch={handleModeSwitch}
              animationDirection="enter"
              onSignUpSuccess={handleSignUpSuccess}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
