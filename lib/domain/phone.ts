import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { hashSecret } from "./tokens";

/**
 * Indian mobile numbers. The brief notes about 15 reports a month sent to the
 * wrong number, so anything that is not clearly a mobile number is refused.
 */

/** Returns +91 followed by 10 digits, or null. */
export function normalisePhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+91")) return null;
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+91 ••••• •3210": enough for a person to recognise their own number. */
export function maskPhone(normalised: string): string {
  return `+91 ••••• •${normalised.slice(-4)}`;
}

/** Keyed hash for lookup. Without the key, the 10 billion possible numbers cannot be tried. */
export function hashPhone(normalised: string, key: string): string {
  return hashSecret(normalised, key);
}

/** AES-256-GCM. Output: base64 of nonce (12 bytes) + auth tag (16 bytes) + ciphertext. */
export function encryptPhone(normalised: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const body = Buffer.concat([cipher.update(normalised, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64");
}

/** Throws if the ciphertext was changed or the key is wrong. */
export function decryptPhone(cipherBase64: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const data = Buffer.from(cipherBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}
