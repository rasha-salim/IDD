export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  if (!email.includes('@')) {
    errors.push('Email must contain @');
  }
  if (email.length < 5) {
    errors.push('Email too short');
  }
  return { valid: errors.length === 0, errors };
}

export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  if (name.trim().length === 0) {
    errors.push('Name cannot be empty');
  }
  if (name.length > 100) {
    errors.push('Name too long');
  }
  return { valid: errors.length === 0, errors };
}
