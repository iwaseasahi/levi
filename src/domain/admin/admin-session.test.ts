import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  hashAdminSessionToken,
  readCookie,
} from "./admin-session";

describe("admin session primitives", () => {
  it("creates an opaque token and a deterministic non-reversible hash", () => {
    const token = createAdminSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashAdminSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAdminSessionToken(token)).not.toContain(token);
  });

  it("reads an exact cookie without accepting similarly named cookies", () => {
    expect(
      readCookie(
        "other=x; levi_admin_session=token; suffix=y",
        "levi_admin_session",
      ),
    ).toBe("token");
    expect(
      readCookie("levi_admin_session_extra=token", "levi_admin_session"),
    ).toBeNull();
  });
});
