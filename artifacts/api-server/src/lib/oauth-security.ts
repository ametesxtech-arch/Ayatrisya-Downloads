import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("A 32-character SESSION_SECRET is required for OAuth cookies.");
  }
  return createHash("sha256").update("ayatrisya-provider-cookie:v1\0").update(secret).digest();
}

/** Encrypts signed-in provider credentials before placing them in an HttpOnly cookie. */
export function sealOAuthCookie(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function openOAuthCookie<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    const [version, rawIv, rawTag, rawCiphertext, ...extra] = value.split(".");
    if (
      version !== "v1" ||
      !rawIv ||
      !rawTag ||
      !rawCiphertext ||
      extra.length > 0
    ) {
      return undefined;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(rawIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(rawTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(rawCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return undefined;
  }
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function createOAuthCookieNonce(): string {
  return randomUUID();
}
