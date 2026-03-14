
/**
 * CRYPTO UTILITY - SHA-256 HASHING
 * Used to ensure plain-text passwords never enter the cloud registry.
 */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convert buffer to hex string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SESSION GENERATOR
 * Creates unique tactical identifiers for session conflict detection.
 */
export function generateSessionId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SID_${timestamp}_${random}`;
}
