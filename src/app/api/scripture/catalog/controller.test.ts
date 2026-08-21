import { describe, expect, it, vi } from "vitest";
import { createScriptureCatalogHandler } from "./controller";

const authorized = {
  churchId: "church-id",
  mustChangePassword: false,
  status: "authorized" as const,
  userId: "user-id",
};

describe("scripture catalog HTTP handler", () => {
  it("returns no-store catalog coordinates to an eligible church user", async () => {
    const readCatalog = vi.fn().mockResolvedValue({
      books: [{ code: "JHN", name: "架空ヨハネ" }],
      chapters: [3],
      verses: [16, 17],
    });
    const handler = createScriptureCatalogHandler({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      readCatalog,
    });
    const response = await handler(
      new Request(
        "https://levi.example/api/scripture/catalog?language=both&book=JHN&chapter=3",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(readCatalog).toHaveBeenCalledWith({
      book: "JHN",
      chapter: 3,
      language: "both",
    });
  });

  it.each([
    [{ status: "unauthenticated" }, 401, "UNAUTHENTICATED"],
    [{ status: "forbidden", userId: "user-id" }, 403, "FORBIDDEN"],
    [{ ...authorized, mustChangePassword: true }, 403, "FORBIDDEN"],
  ] as const)("rejects ineligible access", async (access, status, code) => {
    const readCatalog = vi.fn();
    const handler = createScriptureCatalogHandler({
      getChurchAccess: vi.fn().mockResolvedValue(access),
      readCatalog,
    });
    const response = await handler(
      new Request("https://levi.example/api/scripture/catalog?language=both"),
    );
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: { code } });
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it("rejects an invalid hierarchy before reading the catalog", async () => {
    const readCatalog = vi.fn();
    const handler = createScriptureCatalogHandler({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      readCatalog,
    });
    const response = await handler(
      new Request(
        "https://levi.example/api/scripture/catalog?language=both&chapter=3",
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_SEARCH_INPUT" },
    });
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it("hides unexpected persistence details", async () => {
    const handler = createScriptureCatalogHandler({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      readCatalog: vi
        .fn()
        .mockRejectedValue(new Error("secret database detail")),
    });
    const response = await handler(
      new Request("https://levi.example/api/scripture/catalog?language=both"),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
