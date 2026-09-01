import { describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import { createSlideListHandler } from "./controller";

const scope = {
  churchId: "00000000-0000-4000-8000-000000000385",
} as ChurchScope;
const authorized: ChurchAccess = {
  status: "authorized",
  scope,
  userId: "synthetic",
  mustChangePassword: false,
};

describe("slide collection GET", () => {
  it.each([
    { status: "unauthenticated" } as ChurchAccess,
    { status: "forbidden", userId: "synthetic" } as ChurchAccess,
    { ...authorized, mustChangePassword: true },
  ])(
    "denies ineligible access before parsing or repository",
    async (access) => {
      const list = vi.fn();
      const handler = createSlideListHandler({
        getChurchAccess: async () => access,
        repository: { list },
      });
      const response = await handler(
        new Request("https://levi.example/api/church/slides?churchId=x"),
      );
      expect([401, 403]).toContain(response.status);
      expect(list).not.toHaveBeenCalled();
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it("passes only the authenticated scope and list position", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const handler = createSlideListHandler({
      getChurchAccess: async () => authorized,
      repository: { list },
    });
    const response = await handler(
      new Request("https://levi.example/api/church/slides"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slides: [], nextCursor: null });
    expect(list).toHaveBeenCalledWith(scope, { cursor: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    "q=body",
    "mode=all",
    "mode=recent",
    "churchId=x",
    "cursor=bad",
    "cursor=a&cursor=b",
  ])(
    "rejects removed, unknown, duplicate or invalid query %s",
    async (query) => {
      const list = vi.fn();
      const handler = createSlideListHandler({
        getChurchAccess: async () => authorized,
        repository: { list },
      });
      expect(
        (
          await handler(
            new Request(`https://levi.example/api/church/slides?${query}`),
          )
        ).status,
      ).toBe(400);
      expect(list).not.toHaveBeenCalled();
    },
  );

  it("hides persistence failures", async () => {
    const handler = createSlideListHandler({
      getChurchAccess: async () => authorized,
      repository: {
        list: async () => {
          throw new Error("synthetic private query");
        },
      },
    });
    const response = await handler(
      new Request("https://levi.example/api/church/slides"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "SLIDE_UNAVAILABLE" },
    });
  });
});
