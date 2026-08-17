/**
 * Validation utility functions for authentication forms
 * Requirements: 6.1-6.10, 7.1-7.4, 16.1-16.5
 */

// Form data interfaces
export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export interface SignUpFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * Validates email format using regex pattern
 * Requirement 16.1: Uses pattern /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 * @param email - Email string to validate
 * @returns Error message string or undefined if valid
 */
export function validateEmail(email: string): string | undefined {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  
  return undefined;
}

/**
 * Validates password complexity requirements
 * Requirements 6.4-6.8: Checks 8+ chars, uppercase, lowercase, number, special char
 * @param password - Password string to validate
 * @returns Error message string or undefined if valid
 */
export function validatePassword(password: string): string | undefined {
  if (!password || password.trim() === '') {
    return 'Password is required';
  }
  
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  
  // Special characters check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return 'Password must contain a special character';
  }
  
  return undefined;
}

/**
 * Validates name length requirements
 * Requirements 6.1-6.2: Checks 2-50 characters
 * @param name - Name string to validate
 * @returns Error message string or undefined if valid
 */
export function validateName(name: string): string | undefined {
  if (!name || name.trim() === '') {
    return 'Name is required';
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return 'Name must be at least 2 characters';
  }
  
  if (trimmedName.length > 50) {
    return 'Name must not exceed 50 characters';
  }
  
  return undefined;
}

/**
 * Validates password confirmation matches
 * Requirement 6.9: Compares password fields
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns Error message string or undefined if valid
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | undefined {
  if (!confirmPassword || confirmPassword.trim() === '') {
    return 'Please confirm your password';
  }
  
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  
  return undefined;
}

/**
 * Validates sign-in form and returns errors object
 * Requirements 7.1-7.4: Validates email and password required fields
 * @param formData - Sign-in form data
 * @returns SignInFormErrors object with field-specific errors
 */
export function validateSignInForm(formData: SignInFormData): SignInFormErrors {
  const errors: SignInFormErrors = {};
  
  const emailError = validateEmail(formData.email);
  if (emailError) {
    errors.email = emailError;
  }
  
  if (!formData.password || formData.password.trim() === '') {
    errors.password = 'Password is required';
  }
  
  return errors;
}

/**
 * Validates sign-up form with all validation rules
 * Requirements 6.1-6.10: Validates name, email, password complexity, and password match
 * @param formData - Sign-up form data
 * @returns SignUpFormErrors object with field-specific errors
 */
export function validateSignUpForm(formData: SignUpFormData): SignUpFormErrors {
  const errors: SignUpFormErrors = {};
  
  const nameError = validateName(formData.name);
  if (nameError) {
    errors.name = nameError;
  }
  
  const emailError = validateEmail(formData.email);
  if (emailError) {
    errors.email = emailError;
  }
  
  const passwordError = validatePassword(formData.password);
  if (passwordError) {
    errors.password = passwordError;
  }
  
  const passwordMatchError = validatePasswordMatch(
    formData.password,
    formData.confirmPassword
  );
  if (passwordMatchError) {
    errors.confirmPassword = passwordMatchError;
  }
  
  return errors;
}
