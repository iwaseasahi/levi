import { timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";

import { verifyPassword } from "better-auth/crypto";

import type { AdminBasicAuthConfig } from "@/config/env";

const MAX_AUTHORIZATION_LENGTH = 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function equalText(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

export function parseBasicAuthorization(value: string | null) {
  if (!value || value.length > MAX_AUTHORIZATION_LENGTH) return null;
  const match = /^Basic ([^\s]+)$/i.exec(value);
  const encoded = match?.[1];
  if (!encoded || encoded.length % 4 !== 0 || !BASE64_PATTERN.test(encoded)) {
    return null;
  }

  try {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) return null;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return {
      password: decoded.slice(separator + 1),
      username: decoded.slice(0, separator),
    };
  } catch {
    return null;
  }
}

export async function verifyAdminBasicAuthorization(
  authorization: string | null,
  config: AdminBasicAuthConfig,
) {
  const credentials = parseBasicAuthorization(authorization);
  if (!credentials || !equalText(credentials.username, config.username)) {
    return false;
  }

  try {
    return await verifyPassword({
      hash: config.passwordHash,
      password: credentials.password,
    });
  } catch {
    return false;
  }
}
