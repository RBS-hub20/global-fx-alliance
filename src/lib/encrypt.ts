import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM for broker credentials at rest.
 *
 * `server-only` is the first line on purpose: importing this into a client
 * component becomes a build error rather than a bundle containing the key.
 *
 * Scope of what this protects, stated plainly so it is not mistaken for more:
 * it defends against someone reading the database — a leaked backup, a stolen
 * anon key, SQL injection. It does NOT defend against someone who also holds
 * ENCRYPTION_KEY, because the same key decrypts every record. Whoever holds the
 * environment holds every member's trading credentials.
 */

const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const ALGO = "aes-256-gcm";

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY is not set.");
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

/** True when a usable key is configured, for routes that would rather 503 than throw. */
export function encryptionReady(): boolean {
  try { key(); return true; } catch { return false; }
}

export interface Sealed {
  /** iv:ciphertext:tag, all hex — one column, so a record cannot be half-migrated. */
  payload: string;
  iv: string;
}

/**
 * `aad` binds the ciphertext to the row it belongs to.
 *
 * Without it, a stolen blob can be pasted into another member's row and will
 * decrypt cleanly — the VPS would then trade account A with account B's
 * password. Passing "<user_id>:<account_number>:<server>" makes that swap fail
 * authentication instead of succeeding quietly.
 */
export function encrypt(plaintext: string, aad: string): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    payload: `${iv.toString("hex")}:${body.toString("hex")}:${tag.toString("hex")}`,
    iv: iv.toString("hex"),
  };
}

/** Throws if the payload was tampered with, truncated, or belongs to another row. */
export function decrypt(payload: string, aad: string): string {
  const [ivHex, bodyHex, tagHex] = payload.split(":");
  if (!ivHex || !bodyHex || !tagHex) throw new Error("Malformed ciphertext.");

  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivHex, "hex"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(bodyHex, "hex")), decipher.final()]).toString("utf8");
}

/** The AAD string. One function so the seal and the open cannot disagree. */
export function credentialAad(userId: string, accountNumber: string, server: string): string {
  return `${userId}:${accountNumber}:${server}`;
}

/** Constant-time compare, for anything secret that is checked rather than decrypted. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
