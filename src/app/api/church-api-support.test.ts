import { describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import { noStoreJson, resolveChurchApiAccess } from "./church-api-support";

const scope = { churchId: "church-1" } as ChurchScope;
const authorized = (mustChangePassword: boolean): ChurchAccess => ({
  mustChangePassword,
  scope,
  status: "authorized",
  userId: "user-1",
});

describe("church API support", () => {
  it.each([
    [{ status: "unauthenticated" as const }, 401, "UNAUTHENTICATED"],
    [{ status: "forbidden" as const, userId: "user-1" }, 403, "FORBIDDEN"],
    [authorized(true), 403, "FORBIDDEN"],
  ])(
    "maps an access denial to a no-store response",
    async (access, status, code) => {
      const result = await resolveChurchApiAccess(
        new Headers(),
        vi.fn().mockResolvedValue(access),
      );
      expect(result).toHaveProperty("response");
      if (!("response" in result)) throw new Error("expected access denial");
      expect(result.response.status).toBe(status);
      expect(result.response.headers.get("Cache-Control")).toBe("no-store");
      await expect(result.response.json()).resolves.toEqual({
        error: { code },
      });
    },
  );

  it("returns the server-derived scope for eligible church access", async () => {
    await expect(
      resolveChurchApiAccess(
        new Headers(),
        vi.fn().mockResolvedValue(authorized(false)),
      ),
    ).resolves.toEqual({ scope });
  });

  it("creates successful no-store JSON responses", async () => {
    const response = noStoreJson({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
