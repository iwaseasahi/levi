import { createHash, randomBytes } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "levi_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function createAdminSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAdminSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}
