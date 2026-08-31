import { describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import { createSlideSearchHandler } from "./controller";

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
      const search = vi.fn();
      const handler = createSlideSearchHandler({
        getChurchAccess: async () => access,
        repository: { search },
      });
      const response = await handler(
        new Request("https://levi.example/api/church/slides?churchId=x"),
      );
      expect([401, 403]).toContain(response.status);
      expect(search).not.toHaveBeenCalled();
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
  it("passes only the authenticated scope and normalized search", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const handler = createSlideSearchHandler({
      getChurchAccess: async () => authorized,
      repository: { search },
    });
    const response = await handler(
      new Request("https://levi.example/api/church/slides?q=%20A%0DB%20"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ slides: [], nextCursor: null });
    expect(search).toHaveBeenCalledWith(scope, {
      mode: "all",
      q: " A\nB ",
      cursor: null,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["q=a&q=b", "churchId=x", "cursor=bad", "mode=recent&q=x"])(
    "rejects unknown/duplicate/invalid query %s",
    async (query) => {
      const search = vi.fn();
      const handler = createSlideSearchHandler({
        getChurchAccess: async () => authorized,
        repository: { search },
      });
      expect(
        (
          await handler(
            new Request(`https://levi.example/api/church/slides?${query}`),
          )
        ).status,
      ).toBe(400);
      expect(search).not.toHaveBeenCalled();
    },
  );
  it("hides persistence failures", async () => {
    const handler = createSlideSearchHandler({
      getChurchAccess: async () => authorized,
      repository: {
        search: async () => {
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
