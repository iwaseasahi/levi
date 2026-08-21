import { describe, expect, it, vi } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";

import { ScriptureSearchError } from "@/domain/scripture/search";
import { createScriptureSearchHandler } from "./controller";

const scope = { churchId: "church-id" } as ChurchScope;

const url =
  "https://levi.example/api/scripture/search?book=JHN&chapter=3&startVerse=16&endVerse=18&language=both";

describe("scripture search HTTP handler", () => {
  it.each([
    [{ status: "unauthenticated" }, 401, "UNAUTHENTICATED"],
    [{ status: "forbidden", userId: "user-id" }, 403, "FORBIDDEN"],
    [
      {
        mustChangePassword: true,
        scope,
        status: "authorized",
        userId: "user-id",
      },
      403,
      "FORBIDDEN",
    ],
  ] as const)(
    "denies ineligible access before parsing",
    async (access, status, code) => {
      const search = vi.fn();
      const handler = createScriptureSearchHandler({
        getChurchAccess: vi.fn().mockResolvedValue(access),
        search,
      });
      const response = await handler(
        new Request("https://levi.example/api/scripture/search"),
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: { code } });
      expect(search).not.toHaveBeenCalled();
    },
  );

  it("returns paired results to an active church user without caching", async () => {
    const search = vi.fn().mockResolvedValue({ items: [], search: {} });
    const handler = createScriptureSearchHandler({
      getChurchAccess: vi.fn().mockResolvedValue({
        mustChangePassword: false,
        scope,
        status: "authorized",
        userId: "user-id",
      }),
      search,
    });
    const response = await handler(new Request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(search).toHaveBeenCalledWith({
      book: "JHN",
      chapter: 3,
      startVerse: 16,
      endVerse: 18,
      language: "both",
    });
  });

  it.each([
    ["INVALID_SEARCH_INPUT", 400],
    ["INVALID_VERSE_RANGE", 400],
    ["BOOK_NOT_FOUND", 404],
    ["CHAPTER_NOT_FOUND", 404],
    ["VERSE_RANGE_NOT_FOUND", 404],
    ["TRANSLATION_NOT_AVAILABLE", 409],
    ["CATALOG_INTEGRITY_ERROR", 500],
  ] as const)("maps %s to a stable response", async (code, status) => {
    const handler = createScriptureSearchHandler({
      getChurchAccess: vi.fn().mockResolvedValue({
        mustChangePassword: false,
        scope,
        status: "authorized",
        userId: "user-id",
      }),
      search: vi.fn().mockRejectedValue(new ScriptureSearchError(code)),
    });
    const response = await handler(new Request(url));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: { code } });
  });

  it("hides unexpected persistence details", async () => {
    const handler = createScriptureSearchHandler({
      getChurchAccess: vi.fn().mockResolvedValue({
        mustChangePassword: false,
        scope,
        status: "authorized",
        userId: "user-id",
      }),
      search: vi.fn().mockRejectedValue(new Error("sensitive database detail")),
    });
    const response = await handler(new Request(url));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  });
});
