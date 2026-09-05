import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SCRIPTURE_FONT_SCALE,
  SCRIPTURE_FONT_SCALE_OPTIONS,
  SCRIPTURE_FONT_SCALE_STORAGE_KEY,
  parseScriptureFontScale,
  readScriptureFontScale,
  scriptureFontScalePercentage,
  writeScriptureFontScale,
} from "./scripture-font-scale";

describe("scripture font scale preference", () => {
  it("accepts every 10% step from 60% through 220%", () => {
    expect(SCRIPTURE_FONT_SCALE_OPTIONS).toHaveLength(17);
    expect(SCRIPTURE_FONT_SCALE_OPTIONS.at(0)).toBe(0.6);
    expect(SCRIPTURE_FONT_SCALE_OPTIONS.at(-1)).toBe(2.2);
    expect(
      SCRIPTURE_FONT_SCALE_OPTIONS.every(
        (scale) => parseScriptureFontScale(scale) === scale,
      ),
    ).toBe(true);
  });

  it.each([null, "", "invalid", 0.5, 1.05, 2.3, Number.NaN])(
    "falls back from an invalid saved value %#",
    (value) => {
      expect(parseScriptureFontScale(value)).toBe(DEFAULT_SCRIPTURE_FONT_SCALE);
    },
  );

  it("reads and writes only the validated numeric preference", () => {
    const getItem = vi.fn(() => "1.4");
    const setItem = vi.fn();
    expect(readScriptureFontScale({ getItem })).toBe(1.4);
    expect(getItem).toHaveBeenCalledWith(SCRIPTURE_FONT_SCALE_STORAGE_KEY);
    expect(writeScriptureFontScale(1.6, { setItem })).toBe(1.6);
    expect(setItem).toHaveBeenCalledWith(
      SCRIPTURE_FONT_SCALE_STORAGE_KEY,
      "1.6",
    );
    expect(scriptureFontScalePercentage(1.6)).toBe("160%");
  });

  it("keeps the safe default when browser storage is unavailable", () => {
    expect(
      readScriptureFontScale({
        getItem: () => {
          throw new Error("storage denied");
        },
      }),
    ).toBe(DEFAULT_SCRIPTURE_FONT_SCALE);
    expect(
      writeScriptureFontScale(1.2, {
        setItem: () => {
          throw new Error("storage denied");
        },
      }),
    ).toBe(1.2);
  });
});
