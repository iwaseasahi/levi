import { describe, expect, it, vi } from "vitest";

import { resolveOperatorAccess } from "./operator-access";

const headers = new Headers();

describe("resolveOperatorAccess", () => {
  it("rejects a missing session before querying operator data", async () => {
    const findActiveOperator = vi.fn();

    await expect(
      resolveOperatorAccess(headers, {
        getSessionUserId: vi.fn().mockResolvedValue(null),
        findActiveOperator,
      }),
    ).resolves.toEqual({ status: "unauthenticated" });
    expect(findActiveOperator).not.toHaveBeenCalled();
  });

  it("rejects an authenticated non-operator", async () => {
    await expect(
      resolveOperatorAccess(headers, {
        getSessionUserId: vi.fn().mockResolvedValue("church-user-id"),
        findActiveOperator: vi.fn().mockResolvedValue(false),
      }),
    ).resolves.toEqual({
      status: "forbidden",
      userId: "church-user-id",
    });
  });

  it("returns only the internal ID of an active operator", async () => {
    await expect(
      resolveOperatorAccess(headers, {
        getSessionUserId: vi.fn().mockResolvedValue("operator-id"),
        findActiveOperator: vi.fn().mockResolvedValue(true),
      }),
    ).resolves.toEqual({
      status: "authorized",
      userId: "operator-id",
    });
  });
});
