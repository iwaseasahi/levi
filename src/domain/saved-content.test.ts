import { describe, expect, it } from "vitest";
import {
  languageFromTranslationCodes,
  parseCreateBookmark,
  parseCreateFolder,
  parseReorder,
  parseSavedContentCommand,
  parseUpdateFolder,
  SavedContentError,
} from "./saved-content";

describe("saved content input", () => {
  it("normalizes strict folder input", () => {
    expect(parseCreateFolder({ name: "  礼拝  " })).toEqual({ name: "礼拝" });
    expect(parseUpdateFolder({ isPinned: true })).toEqual({ isPinned: true });
  });

  it("accepts a typed scripture range", () => {
    expect(
      parseCreateBookmark({
        title: "創世記",
        book: "GEN",
        chapter: 1,
        startVerse: 1,
        endVerse: 3,
        language: "both",
      }),
    ).toMatchObject({ book: "GEN", language: "both" });
  });

  it("rejects the removed bookmark update command", () => {
    expect(() =>
      parseSavedContentCommand({
        action: "update-bookmark",
        bookmarkId: "00000000-0000-4000-8000-000000000054",
        title: "変更後",
      }),
    ).toThrow(
      expect.objectContaining<Partial<SavedContentError>>({
        code: "INVALID_SAVED_CONTENT_INPUT",
      }),
    );
  });

  it.each([
    [{ name: " " }, parseCreateFolder],
    [{}, parseUpdateFolder],
    [
      {
        ids: [
          "00000000-0000-4000-8000-000000000054",
          "00000000-0000-4000-8000-000000000054",
        ],
      },
      parseReorder,
    ],
    [
      {
        title: "Reverse",
        book: "GEN",
        chapter: 1,
        startVerse: 3,
        endVerse: 1,
        language: "both",
      },
      parseCreateBookmark,
    ],
  ] as const)("rejects invalid input %#", (value, parser) => {
    expect(() => parser(value as never)).toThrow(
      expect.objectContaining<Partial<SavedContentError>>({
        code: "INVALID_SAVED_CONTENT_INPUT",
      }),
    );
  });

  it("maps only supported translation selections", () => {
    expect(languageFromTranslationCodes("JSS3", null)).toBe("ja");
    expect(languageFromTranslationCodes("NKJV", null)).toBe("en");
    expect(languageFromTranslationCodes("JSS3", "NKJV")).toBe("both");
    expect(() => languageFromTranslationCodes("NKJV", "JSS3")).toThrow(
      expect.objectContaining({ code: "SAVED_CONTENT_CATALOG_ERROR" }),
    );
  });
});
