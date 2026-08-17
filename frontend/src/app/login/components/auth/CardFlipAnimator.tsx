"use client";

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CardFlipAnimatorProps } from "../../types/auth";

/**
 * CardFlipAnimator Component
 * 
 * A wrapper component that applies 3D flip, slide, or fade animation effects to child cards.
 * Supports accessibility through reduced motion preferences.
 * 
 * Features:
 * - Three animation types: flip (3D rotation), slide (horizontal translation), fade (opacity/scale)
 * - Detects and respects user's reduced motion preference
 * - Smooth transitions with cubic-bezier easing
 * - GPU-accelerated transforms for optimal performance
 * 
 * Requirements: 2.1-2.5, 10.1-10.5, 18.1-18.5
 */
export const CardFlipAnimator: React.FC<CardFlipAnimatorProps> = ({
  children,
  isActive,
  direction,
  animationType = "flip",
  reduceMotion: reduceMotionProp = false,
}) => {
  // Detect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = reduceMotionProp || prefersReducedMotion;

  // Cubic-bezier easing for smooth animations
  const easing: [number, number, number, number] = [0.22, 1, 0.36, 1];

  /**
   * Animation variants for different animation types
   * Each type has enter and exit states
   */
  const getAnimationVariants = () => {
    // Reduced motion: simple opacity-only with 0.2s duration
    if (shouldReduceMotion) {
      return {
        enter: {
          opacity: 1,
          transition: { duration: 0.2, ease: easing },
        },
        exit: {
          opacity: 0,
          transition: { duration: 0.2, ease: easing },
        },
      };
    }

    // Full animations based on type
    switch (animationType) {
      case "flip":
        return {
          enter: {
            rotateY: 0,
            opacity: 1,
            scale: 1,
            transition: { duration: 0.6, ease: easing },
          },
          exit: {
            rotateY: 90,
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.6, ease: easing },
          },
        };

      case "slide":
        return {
          enter: {
            x: 0,
            opacity: 1,
            transition: { duration: 0.5, ease: easing },
          },
          exit: {
            x: direction === "exit" ? -300 : 300,
            opacity: 0,
            transition: { duration: 0.5, ease: easing },
          },
        };

      case "fade":
        return {
          enter: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.4, ease: easing },
          },
          exit: {
            opacity: 0,
            scale: 0.96,
            transition: { duration: 0.4, ease: easing },
          },
        };

      default:
        // Fallback to flip animation
        return {
          enter: {
            rotateY: 0,
            opacity: 1,
            scale: 1,
            transition: { duration: 0.6, ease: easing },
          },
          exit: {
            rotateY: 90,
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.6, ease: easing },
          },
        };
    }
  };

  const variants = getAnimationVariants();

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          initial="exit"
          animate="enter"
          exit="exit"
          variants={variants}
          style={{
            // Apply 3D perspective for flip animations (only when not reduced motion)
            perspective: !shouldReduceMotion && animationType === "flip" ? "1200px" : undefined,
            transformStyle: !shouldReduceMotion && animationType === "flip" ? "preserve-3d" : undefined,
            // Hint browser to use GPU acceleration
            willChange: shouldReduceMotion ? "opacity" : "transform, opacity",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
