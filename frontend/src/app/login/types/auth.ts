/**
 * Shared type definitions for authentication components
 * 
 * This file contains all TypeScript interfaces and types used across
 * the animated login/signup card system, including form data models,
 * validation errors, animation configurations, and component states.
 */

/**
 * Authentication mode type
 * Represents whether the user is in sign-in or sign-up mode
 */
export type AuthMode = 'signin' | 'signup';

/**
 * Sign-in form data structure
 * Contains the fields required for user login
 */
export interface SignInFormData {
  email: string;
  password: string;
}

/**
 * Sign-in form validation errors
 * Maps field names to their error messages
 */
export interface SignInFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

/**
 * Sign-up form data structure
 * Contains all fields required for user registration
 */
export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Sign-up form validation errors
 * Maps field names to their error messages
 */
export interface SignUpFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * Animation type options for card transitions
 */
export type AnimationType = 'flip' | 'slide' | 'fade';

/**
 * Animation configuration for card transitions
 * Controls how cards animate when switching between modes
 */
export interface AnimationConfig {
  /** Type of animation: flip (3D rotation), slide (horizontal), or fade (opacity) */
  type: AnimationType;
  
  /** Duration of the animation in seconds */
  duration: number;
  
  /** Cubic bezier easing curve [x1, y1, x2, y2] */
  ease: [number, number, number, number];
  
  /** Perspective value for 3D transforms (in pixels) */
  perspective: number;
  
  /** Whether to use reduced motion for accessibility */
  reduceMotion: boolean;
}

/**
 * Default animation configuration
 * Used when no custom configuration is provided
 */
export const defaultAnimationConfig: AnimationConfig = {
  type: 'flip',
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1],
  perspective: 1200,
  reduceMotion: false,
};

/**
 * Authentication card container state
 * Tracks the current mode and transition state of the card system
 */
export interface AuthCardContainerState {
  /** Current authentication mode (signin or signup) */
  current: AuthMode;
  
  /** Previous authentication mode (null on initial render) */
  previous: AuthMode | null;
  
  /** Whether a mode transition animation is currently in progress */
  isTransitioning: boolean;
  
  /** Timestamp when the current transition started (null when not transitioning) */
  transitionStartTime: number | null;
}

/**
 * Props for the AuthCardContainer component
 */
export interface AuthCardContainerProps {
  /** Initial mode to display (defaults to 'signin') */
  initialMode?: AuthMode;
  
  /** Callback invoked when authentication succeeds */
  onAuthSuccess?: () => void;
}

/**
 * Props for individual card components (SignInCard, SignUpCard)
 */
export interface CardProps {
  /** Whether this card is currently active/visible */
  isActive: boolean;
  
  /** Callback to switch between signin and signup modes */
  onModeSwitch: () => void;
  
  /** Animation direction (enter or exit) */
  animationDirection: 'enter' | 'exit';
}

/**
 * Props for the SignUpCard component
 * Extends CardProps with signup-specific callbacks
 */
export interface SignUpCardProps extends CardProps {
  /** Callback invoked when signup succeeds */
  onSignUpSuccess?: (email: string) => void;
}

/**
 * Props for the CardFlipAnimator wrapper component
 */
export interface CardFlipAnimatorProps {
  /** Child components to animate */
  children: React.ReactNode;
  
  /** Whether this card is currently active */
  isActive: boolean;
  
  /** Animation direction (enter or exit) */
  direction: 'enter' | 'exit';
  
  /** Type of animation to apply */
  animationType?: AnimationType;
  
  /** Whether to use reduced motion for accessibility */
  reduceMotion?: boolean;
}

/**
 * Props for the reusable FormField component
 */
export interface FormFieldProps {
  /** Input type (text, email, or password) */
  type: 'text' | 'email' | 'password';
  
  /** Field label displayed above the input */
  label: string;
  
  /** Current value of the field */
  value: string;
  
  /** Callback invoked when the field value changes */
  onChange: (value: string) => void;
  
  /** Optional error message to display below the field */
  error?: string;
  
  /** Optional placeholder text */
  placeholder?: string;
  
  /** Optional icon component to display on the right side */
  icon?: React.ComponentType<{ className?: string }>;
  
  /** Whether to show password visibility toggle (for password fields) */
  showPasswordToggle?: boolean;
  
  /** Whether this field is required */
  required?: boolean;
  
  /** Autocomplete attribute for browser autofill */
  autoComplete?: string;
  
  /** Optional callback invoked when field loses focus */
  onBlur?: () => void;
}

/**
 * Password strength score
 * Used for optional password strength indicator
 */
export interface PasswordStrength {
  /** Strength score from 0 (weak) to 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  
  /** Array of feedback messages for improving password */
  feedback: string[];
}
