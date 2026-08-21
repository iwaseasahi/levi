import { describe, expect, it, vi } from "vitest";

import {
  resolveChurchAccess,
  type ChurchAccessDependencies,
} from "./church-access";

function dependencies(
  overrides: Partial<ChurchAccessDependencies> = {},
): ChurchAccessDependencies {
  return {
    findActiveChurchMembership: vi.fn().mockResolvedValue({
      churchId: "church-id",
      mustChangePassword: false,
    }),
    getSessionUserId: vi.fn().mockResolvedValue("user-id"),
    ...overrides,
  };
}

describe("Church tenant access", () => {
  it("derives an authorized tenant from the session user", async () => {
    await expect(
      resolveChurchAccess(new Headers(), dependencies()),
    ).resolves.toEqual({
      churchId: "church-id",
      mustChangePassword: false,
      status: "authorized",
      userId: "user-id",
    });
  });

  it("denies unauthenticated access before a tenant lookup", async () => {
    const deps = dependencies({
      getSessionUserId: vi.fn().mockResolvedValue(null),
    });

    await expect(resolveChurchAccess(new Headers(), deps)).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(deps.findActiveChurchMembership).not.toHaveBeenCalled();
  });

  it("denies an authenticated identity without an active Church", async () => {
    await expect(
      resolveChurchAccess(
        new Headers(),
        dependencies({
          findActiveChurchMembership: vi.fn().mockResolvedValue(null),
        }),
      ),
    ).resolves.toEqual({ status: "forbidden", userId: "user-id" });
  });
});
