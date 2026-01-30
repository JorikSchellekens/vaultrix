/**
 * TOTP/HOTP (Google Authenticator–style). Client-side only; no network.
 * Uses a simple RFC 6238–compatible implementation.
 */
const T0 = 0;
const STEP = 30;
const DIGITS = 6;

function base32Decode(encoded: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of encoded.toUpperCase().replace(/=+$/, "")) {
    const i = alphabet.indexOf(c);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function bigEndianUint64(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, n >>> 0, false);
  view.setUint32(0, Math.floor(n / 0x100000000), false);
  return new Uint8Array(buf);
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
}

function dynamicTruncation(hash: ArrayBuffer): number {
  const bytes = new Uint8Array(hash);
  const offset = bytes[19]! & 0x0f;
  return (
    ((bytes[offset]! & 0x7f) << 24) |
    ((bytes[offset + 1]! & 0xff) << 16) |
    ((bytes[offset + 2]! & 0xff) << 8) |
    (bytes[offset + 3]! & 0xff)
  );
}

/**
 * Generate current TOTP code (6 digits).
 */
export async function generateTotp(secretBase32: string, nowMs = Date.now()): Promise<string> {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor((nowMs / 1000 - T0) / STEP);
  const counterBytes = bigEndianUint64(counter);
  const sig = await hmacSha1(secret, counterBytes);
  const code = dynamicTruncation(sig) % Math.pow(10, DIGITS);
  return code.toString().padStart(DIGITS, "0");
}

/**
 * Seconds until next code (0–30).
 */
export function totpCountdown(nowMs = Date.now()): number {
  const elapsed = (nowMs / 1000 - T0) % STEP;
  return Math.ceil(STEP - elapsed);
}
