/**
 * App-level encryption with K_vault (AES-256-GCM).
 * Each payload is encrypted with a random IV; IV + ciphertext + authTag stored as a bundle.
 */
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

export interface CiphertextBundle {
  iv: string;
  ct: string;
  tag: string;
}

/**
 * Encrypt plaintext with K_vault. Returns base64-encoded IV, ciphertext, and auth tag.
 */
export async function encryptWithVaultKey(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<CiphertextBundle> {
  if (key.length !== 32) throw new Error("K_vault must be 32 bytes");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    cryptoKey,
    plaintext as BufferSource
  );
  const enc = new Uint8Array(encrypted);
  const tagStart = enc.length - TAG_LENGTH / 8;
  const ciphertext = enc.slice(0, tagStart);
  const tag = enc.slice(tagStart);
  return {
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
    tag: bytesToBase64(tag),
  };
}

/**
 * Decrypt a bundle. Validates auth tag before returning.
 */
export async function decryptWithVaultKey(
  bundle: CiphertextBundle,
  key: Uint8Array
): Promise<Uint8Array> {
  if (key.length !== 32) throw new Error("K_vault must be 32 bytes");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["decrypt"]
  );
  const ivBytes = base64ToBytes(bundle.iv);
  const ct = base64ToBytes(bundle.ct);
  const tag = base64ToBytes(bundle.tag);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const dataBuffer = combined.buffer.slice(
    combined.byteOffset,
    combined.byteOffset + combined.byteLength
  );
  const ivBuffer = ivBytes.buffer.slice(
    ivBytes.byteOffset,
    ivBytes.byteOffset + ivBytes.byteLength
  ) as ArrayBuffer;
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer, tagLength: TAG_LENGTH },
    cryptoKey,
    dataBuffer as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

/**
 * Serialize bundle to a single string (e.g. for event content).
 * Format: base64(iv) + "." + base64(ct) + "." + base64(tag)
 */
export function serializeCiphertextBundle(bundle: CiphertextBundle): string {
  return `${bundle.iv}.${bundle.ct}.${bundle.tag}`;
}

/**
 * Parse serialized bundle.
 */
export function parseCiphertextBundle(serialized: string): CiphertextBundle {
  const parts = serialized.split(".");
  if (parts.length !== 3) throw new Error("Invalid ciphertext bundle");
  return { iv: parts[0], ct: parts[1], tag: parts[2] };
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
