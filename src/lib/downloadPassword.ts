// Time-based password generator - rotates every 3 minutes
const PASSWORD_ROTATION_MS = 3 * 60 * 1000; // 3 minutes
const SECRET_SEED = 'bizguard-download-2024'; // Shared secret for deterministic generation

// Simple hash function for browser compatibility
async function simpleHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get current time window (floor to nearest 3 minutes)
export function getCurrentTimeWindow(): number {
  return Math.floor(Date.now() / PASSWORD_ROTATION_MS);
}

// Get time remaining in current window (in seconds)
export function getTimeRemaining(): number {
  const elapsed = Date.now() % PASSWORD_ROTATION_MS;
  return Math.ceil((PASSWORD_ROTATION_MS - elapsed) / 1000);
}

// Generate password for a given time window
export async function generatePassword(timeWindow?: number): Promise<string> {
  const window = timeWindow ?? getCurrentTimeWindow();
  const hash = await simpleHash(`${SECRET_SEED}-${window}`);
  // Take first 8 chars and format as readable code (e.g., ABCD-1234)
  const code = hash.substring(0, 8).toUpperCase();
  return `${code.substring(0, 4)}-${code.substring(4, 8)}`;
}

// Validate a password against current window
export async function validatePassword(password: string): Promise<boolean> {
  const currentPassword = await generatePassword();
  return password.toUpperCase().replace(/\s/g, '') === currentPassword;
}
