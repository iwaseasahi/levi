import { describe, expect, it, vi } from "vitest";

import type { ScriptureSearch } from "@/domain/scripture/search";
import { searchScripture } from "./search-scripture";

const search: ScriptureSearch = {
  book: "JHN",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
  language: "both",
};

describe("searchScripture", () => {
  it.each([
    [{ bookExists: false }, "BOOK_NOT_FOUND"],
    [{ availableTranslations: ["JSS3"] }, "TRANSLATION_NOT_AVAILABLE"],
    [{ chapterExists: false }, "CHAPTER_NOT_FOUND"],
    [{ chapterTranslations: ["JSS3"] }, "TRANSLATION_NOT_AVAILABLE"],
  ] as const)("maps catalog state to %s", async (override, code) => {
    const repository = {
      readRange: vi.fn().mockResolvedValue({
        availableTranslations: ["JSS3", "NKJV"],
        bookExists: true,
        chapterExists: true,
        chapterTranslations: ["JSS3", "NKJV"],
        rows: [],
        ...override,
      }),
    };
    await expect(searchScripture(repository, search)).rejects.toMatchObject({
      code,
    });
    expect(repository.readRange).toHaveBeenCalledOnce();
  });
});
