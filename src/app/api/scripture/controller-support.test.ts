import { describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import { churchAccessFailure, noStoreJson } from "./controller-support";

const authorized = (mustChangePassword: boolean): ChurchAccess => ({
  mustChangePassword,
  scope: { churchId: "church-1" } as ChurchScope,
  status: "authorized",
  userId: "user-1",
});

describe("scripture controller support", () => {
  it.each([
    [{ status: "unauthenticated" as const }, 401, "UNAUTHENTICATED"],
    [{ status: "forbidden" as const, userId: "user-1" }, 403, "FORBIDDEN"],
    [authorized(true), 403, "FORBIDDEN"],
  ])(
    "maps an access denial to a no-store response",
    async (access, status, code) => {
      const response = await churchAccessFailure(
        new Headers(),
        vi.fn().mockResolvedValue(access),
      );
      expect(response?.status).toBe(status);
      expect(response?.headers.get("Cache-Control")).toBe("no-store");
      await expect(response?.json()).resolves.toEqual({ error: { code } });
    },
  );

  it("permits an eligible church access", async () => {
    await expect(
      churchAccessFailure(
        new Headers(),
        vi.fn().mockResolvedValue(authorized(false)),
      ),
    ).resolves.toBeNull();
  });

  it("creates successful no-store JSON responses", async () => {
    const response = noStoreJson({ ok: true }, 200);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
