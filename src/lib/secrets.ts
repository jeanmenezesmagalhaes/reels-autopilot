// AES-256-GCM for secrets stored in the database (the Instagram token).
// Key: TOKEN_ENC_KEY (64 hex chars), kept only in Vercel env. A database leak
// alone never reveals the token.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) throw new Error("TOKEN_ENC_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `enc1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "enc1" || !iv || !tag || !data) throw new Error("unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
