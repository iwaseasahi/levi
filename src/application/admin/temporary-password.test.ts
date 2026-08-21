import { describe, expect, it } from "vitest";

import { generateTemporaryPassword } from "./temporary-password";

describe("generateTemporaryPassword", () => {
  it("returns independent Better Auth-compatible high-entropy values", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();

    expect(first).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(first).not.toBe(second);
  });
});
