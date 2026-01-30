/**
 * Recovery QR: encode Matrix recovery key for scanning on new device.
 * Format: matrix-recovery-key:<base64-or-hex-key>
 */
const PREFIX = "matrix-recovery-key:";

export function encodeRecoveryKeyForQr(recoveryKey: string): string {
  return PREFIX + recoveryKey;
}

export function decodeRecoveryKeyFromQr(payload: string): string | null {
  if (!payload.startsWith(PREFIX)) return null;
  return payload.slice(PREFIX.length).trim();
}
