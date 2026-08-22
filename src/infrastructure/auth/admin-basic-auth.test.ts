import { describe, expect, it, vi } from "vitest";

import { INTERNAL_PLATFORM_OPERATOR_ID } from "@/domain/admin/platform-operator";
import { createAdminBasicAuthenticator } from "./admin-basic-auth";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    failures: {
      clear: vi.fn(async () => undefined),
      isBlocked: vi.fn(async () => false),
      record: vi.fn(async () => 1),
    },
    findActiveInternalOperator: vi.fn(async () => true),
    verify: vi.fn(async () => true),
    ...overrides,
  };
}

describe("createAdminBasicAuthenticator", () => {
  it("maps valid credentials to the fixed internal operator", async () => {
    const deps = dependencies();
    const authenticate = createAdminBasicAuthenticator(deps);

    await expect(authenticate("Basic valid")).resolves.toEqual({
      status: "authorized",
      userId: INTERNAL_PLATFORM_OPERATOR_ID,
    });
    expect(deps.failures.clear).toHaveBeenCalledOnce();
  });

  it("records invalid credentials and rate limits the threshold attempt", async () => {
    const deps = dependencies({
      failures: {
        clear: vi.fn(async () => undefined),
        isBlocked: vi.fn(async () => false),
        record: vi.fn(async () => 5),
      },
      verify: vi.fn(async () => false),
    });
    const authenticate = createAdminBasicAuthenticator(deps);

    await expect(authenticate(null)).resolves.toEqual({
      status: "rate-limited",
    });
  });

  it("does not verify credentials while the global limit is active", async () => {
    const deps = dependencies({
      failures: {
        clear: vi.fn(async () => undefined),
        isBlocked: vi.fn(async () => true),
        record: vi.fn(async () => 0),
      },
    });
    const authenticate = createAdminBasicAuthenticator(deps);

    await expect(authenticate("Basic valid")).resolves.toEqual({
      status: "rate-limited",
    });
    expect(deps.verify).not.toHaveBeenCalled();
  });

  it("fails closed when the fixed operator is absent or a dependency fails", async () => {
    const missing = createAdminBasicAuthenticator(
      dependencies({ findActiveInternalOperator: vi.fn(async () => false) }),
    );
    const failed = createAdminBasicAuthenticator(
      dependencies({
        verify: vi.fn(async () => Promise.reject(new Error("db"))),
      }),
    );

    await expect(missing("Basic valid")).resolves.toEqual({
      status: "unavailable",
    });
    await expect(failed("Basic valid")).resolves.toEqual({
      status: "unavailable",
    });
  });
});
