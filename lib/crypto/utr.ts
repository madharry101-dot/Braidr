import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Application-layer encryption for the UTR (Unique Taxpayer Reference,
// braidr_pro_progress.step2_utr). See the migration note in
// 20260826000009_braidr_pro_progress.sql for why this is done in Node
// rather than with pgcrypto in the database.
//
// UTR_ENCRYPTION_KEY must be a 32-byte key, base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.UTR_ENCRYPTION_KEY;
  if (!b64) throw new Error("UTR_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("UTR_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

/** Encrypts a UTR for storage. Output format: base64(iv):base64(authTag):base64(ciphertext) */
export function encryptUtr(plaintextUtr: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextUtr, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

/** Decrypts a value produced by encryptUtr. Throws if the ciphertext was tampered with. */
export function decryptUtr(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("malformed encrypted UTR value");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** For display only — e.g. "****5678" (PRD/TRD: "masked in display"). */
export function maskUtr(plaintextUtr: string): string {
  const last4 = plaintextUtr.slice(-4);
  return `****${last4}`;
}
