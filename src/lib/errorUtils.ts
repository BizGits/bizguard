// Sanitize database errors to prevent information leakage
// Maps known Postgres error codes to user-friendly messages

const ERROR_MAP: Record<string, string> = {
  '23505': 'This item already exists',
  '23503': 'Referenced item not found',
  '23502': 'Required field is missing',
  '22001': 'Input is too long',
  '23514': 'Value does not meet requirements',
  '42501': 'Permission denied',
  '42P01': 'Resource not found',
  'PGRST116': 'No records found',
};

export function sanitizeDbError(error: unknown, fallbackMessage = 'An error occurred. Please try again.'): string {
  if (!error || typeof error !== 'object') {
    return fallbackMessage;
  }

  const err = error as { code?: string; message?: string };

  // Check for known Postgres error codes
  if (err.code && ERROR_MAP[err.code]) {
    return ERROR_MAP[err.code];
  }

  // Log the actual error for debugging (server-side only in production)
  console.error('Database operation failed:', err.code || 'unknown', err.message);

  // Return generic message to user
  return fallbackMessage;
}
