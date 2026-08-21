import { describe, expect, it, vi } from "vitest";
import {
  navigateScripture,
  type ScriptureNavigationRepository,
} from "./navigate-scripture";

const navigation = {
  book: "MAL",
  chapter: 4,
  verse: 6,
  direction: "next" as const,
  language: "both" as const,
};

describe("navigate scripture", () => {
  it("reports a canonical book and testament boundary crossing", async () => {
    const repository: ScriptureNavigationRepository = {
      readAdjacent: vi.fn().mockResolvedValue({
        approvedTranslations: ["JSS3", "NKJV"],
        bookExists: true,
        currentExists: true,
        location: { book: "MAT", chapter: 1, verse: 1 },
        rows: [
          {
            bookCode: "MAT",
            bookName: "架空マタイ",
            chapter: 1,
            verse: 1,
            translation: "JSS3",
            text: "日本語テスト本文",
          },
          {
            bookCode: "MAT",
            bookName: "Synthetic Matthew",
            chapter: 1,
            verse: 1,
            translation: "NKJV",
            text: "English test text",
          },
        ],
      }),
    };
    await expect(
      navigateScripture(repository, navigation),
    ).resolves.toMatchObject({
      crossedBook: true,
      crossedChapter: true,
      edge: null,
      item: { location: { book: "MAT", chapter: 1, verse: 1 } },
    });
  });

  it("returns a stable whole-corpus edge", async () => {
    const repository: ScriptureNavigationRepository = {
      readAdjacent: vi.fn().mockResolvedValue({
        approvedTranslations: ["JSS3", "NKJV"],
        bookExists: true,
        currentExists: true,
        location: null,
        rows: [],
      }),
    };
    await expect(navigateScripture(repository, navigation)).resolves.toEqual({
      crossedBook: false,
      crossedChapter: false,
      edge: "book-end",
      item: null,
    });
  });
});
