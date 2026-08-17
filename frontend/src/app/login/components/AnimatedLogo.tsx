"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

// ─── AnimatedLogo Props Interface ──────────────────────────────────────────

export interface AnimatedLogoProps {
  onAnimationComplete: () => void;
  reduceMotion: boolean;
}

// ─── Animation Phase Type ──────────────────────────────────────────────────

type AnimationPhase = "scale" | "fade";

// ─── AnimatedLogo Component ────────────────────────────────────────────────

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  onAnimationComplete,
  reduceMotion,
}) => {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("scale");
  const completionTriggered = useRef(false);

  // Animation variants with proper timing
  const variants = {
    scale: {
      scale: reduceMotion ? 1 : 1,
      opacity: 1,
      transition: {
        duration: reduceMotion ? 0 : 1.5,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
    fade: {
      opacity: 0,
      scale: reduceMotion ? 1 : 1.05,
      transition: {
        duration: reduceMotion ? 0.15 : 0.8,
        ease: "easeIn",
      },
    },
  } as const;

  // Handle animation completion with callback chaining
  const handleAnimationComplete = useCallback(() => {
    if (animationPhase === "scale") {
      // Transition to fade phase
      setAnimationPhase("fade");
    } else if (animationPhase === "fade") {
      // Animation sequence complete, trigger parent callback
      if (!completionTriggered.current) {
        completionTriggered.current = true;
        onAnimationComplete();
      }
    }
  }, [animationPhase, onAnimationComplete]);

  // Render animated logo
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={animationPhase}
      variants={variants}
      onAnimationComplete={handleAnimationComplete}
      className="flex flex-col items-center justify-center space-y-6"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Icon Container */}
      <div
        className="relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-white/40 bg-white/10 backdrop-blur-md"
        style={{ boxShadow: "0 0 25px rgba(255,255,255,0.6), inset 0 0 15px rgba(255,255,255,0.4)" }}
      >
        <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={2} style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.8))" }} />
      </div>

      {/* NEXORA Text */}
      <h1
        className="text-4xl md:text-6xl font-black tracking-[0.15em] text-white uppercase select-none mt-2"
        style={{ textShadow: "0 0 25px rgba(255,255,255,0.8), 0 0 50px rgba(255,255,255,0.5)" }}
      >
        NEXORA
      </h1>

      {/* Opening Workspace Text */}
      <p className="text-[10px] md:text-xs font-semibold tracking-[0.4em] text-white/90 uppercase select-none mt-6 animate-pulse"
        style={{ textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>
        Opening Workspace...
      </p>
    </motion.div>
  );
};

export default AnimatedLogo;
