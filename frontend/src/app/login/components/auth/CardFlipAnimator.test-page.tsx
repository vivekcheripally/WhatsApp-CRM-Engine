"use client";

import React, { useState } from "react";
import { CardFlipAnimator } from "./CardFlipAnimator";
import { AnimationType } from "../../types/auth";

/**
 * Test page for CardFlipAnimator component
 * 
 * This page allows manual testing of all animation types and reduced motion mode.
 * To test, temporarily import this component into the login page.
 */
export const CardFlipAnimatorTestPage: React.FC = () => {
  const [isActive, setIsActive] = useState(true);
  const [animationType, setAnimationType] = useState<AnimationType>("flip");
  const [reduceMotion, setReduceMotion] = useState(false);

  const handleToggle = () => {
    setIsActive(false);
    setTimeout(() => {
      setIsActive(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ede5ff] via-[#e0d4fc] to-[#d5ccff] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-800">
            CardFlipAnimator Test Page
          </h1>

          {/* Animation Type Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Animation Type
            </label>
            <div className="flex gap-3">
              {(["flip", "slide", "fade"] as AnimationType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setAnimationType(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    animationType === type
                      ? "bg-violet-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="reduceMotion"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
            />
            <label
              htmlFor="reduceMotion"
              className="text-sm font-semibold text-slate-700"
            >
              Reduce Motion
            </label>
          </div>

          {/* Trigger Button */}
          <button
            onClick={handleToggle}
            className="w-full px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors"
          >
            Trigger Animation
          </button>

          {/* Instructions */}
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              <strong>Instructions:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Select an animation type (flip, slide, or fade)</li>
              <li>Toggle "Reduce Motion" to test accessibility mode</li>
              <li>Click "Trigger Animation" to see the effect</li>
              <li>
                With "Reduce Motion" enabled, animations should be simple
                opacity-only (0.2s)
              </li>
            </ul>
          </div>
        </div>

        {/* Animation Preview */}
        <div className="relative" style={{ minHeight: "400px" }}>
          <CardFlipAnimator
            isActive={isActive}
            direction="enter"
            animationType={animationType}
            reduceMotion={reduceMotion}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-8 mx-auto max-w-md">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-slate-800">
                    Test Card
                  </h2>
                  <p className="text-slate-600 mt-2">
                    Animation: <strong>{animationType}</strong>
                  </p>
                  <p className="text-slate-600">
                    Reduced Motion:{" "}
                    <strong>{reduceMotion ? "Yes" : "No"}</strong>
                  </p>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="space-y-4">
                  <p className="text-slate-700">
                    This card demonstrates the CardFlipAnimator component with
                    various animation types.
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-800">
                      Expected Behavior:
                    </h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      {animationType === "flip" && (
                        <>
                          <li>• 3D rotation on Y-axis (rotateY)</li>
                          <li>• 1200px perspective</li>
                          <li>• 0.6s duration</li>
                          <li>• Opacity and scale effects</li>
                        </>
                      )}
                      {animationType === "slide" && (
                        <>
                          <li>• Horizontal translation (x-axis)</li>
                          <li>• Moves from -300px or 300px to 0</li>
                          <li>• 0.5s duration</li>
                          <li>• Opacity fade</li>
                        </>
                      )}
                      {animationType === "fade" && (
                        <>
                          <li>• Opacity transition only</li>
                          <li>• Scale from 0.96 to 1.0</li>
                          <li>• 0.4s duration</li>
                          <li>• No translation or rotation</li>
                        </>
                      )}
                      {reduceMotion && (
                        <li className="text-violet-600 font-semibold">
                          ⚠️ Reduced motion: opacity-only, 0.2s
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardFlipAnimator>
        </div>
      </div>
    </div>
  );
};
