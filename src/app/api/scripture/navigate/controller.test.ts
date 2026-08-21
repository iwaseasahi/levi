import { describe, expect, it, vi } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import { ScriptureSearchError } from "@/domain/scripture/search";
import { createScriptureNavigationHandler } from "./controller";

const url =
  "https://levi.example/api/scripture/navigate?book=GEN&chapter=1&verse=31&direction=next&language=both";
const authorized = {
  mustChangePassword: false,
  scope: { churchId: "church-id" } as ChurchScope,
  status: "authorized" as const,
  userId: "user-id",
};

describe("scripture navigation HTTP handler", () => {
  it("returns a no-store adjacent item", async () => {
    const navigate = vi.fn().mockResolvedValue({
      crossedBook: false,
      crossedChapter: true,
      edge: null,
      item: { location: { book: "GEN", chapter: 2, verse: 1 }, texts: {} },
    });
    const handler = createScriptureNavigationHandler({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      navigate,
    });
    const response = await handler(new Request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(navigate).toHaveBeenCalledWith({
      book: "GEN",
      chapter: 1,
      verse: 31,
      direction: "next",
      language: "both",
    });
  });

  it.each([
    [{ status: "unauthenticated" }, 401],
    [{ status: "forbidden", userId: "user-id" }, 403],
    [{ ...authorized, mustChangePassword: true }, 403],
  ] as const)("rejects ineligible access", async (access, status) => {
    const navigate = vi.fn();
    const handler = createScriptureNavigationHandler({
      getChurchAccess: vi.fn().mockResolvedValue(access),
      navigate,
    });
    expect((await handler(new Request(url))).status).toBe(status);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_SEARCH_INPUT", 400],
    ["BOOK_NOT_FOUND", 404],
    ["VERSE_RANGE_NOT_FOUND", 404],
    ["TRANSLATION_NOT_AVAILABLE", 409],
    ["CATALOG_INTEGRITY_ERROR", 500],
  ] as const)("maps %s to %s", async (code, status) => {
    const handler = createScriptureNavigationHandler({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      navigate: vi.fn().mockRejectedValue(new ScriptureSearchError(code)),
    });
    const response = await handler(new Request(url));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: { code } });
  });
});
