import { describe, expect, it, vi } from "vitest";

import { readScriptureCatalog } from "./read-scripture-catalog";

describe("readScriptureCatalog", () => {
  it("delegates the validated query to its repository", async () => {
    const query = { book: "GEN", chapter: 1, language: "both" as const };
    const catalog = { books: [], chapters: [1], verses: [1, 2, 3] };
    const repository = { read: vi.fn().mockResolvedValue(catalog) };

    await expect(readScriptureCatalog(repository, query)).resolves.toBe(
      catalog,
    );
    expect(repository.read).toHaveBeenCalledWith(query);
  });
});
