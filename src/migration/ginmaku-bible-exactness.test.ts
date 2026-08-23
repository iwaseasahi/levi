import { describe, expect, it } from "vitest";

import {
  evaluateBibleExactness,
  type BibleTargetEvidence,
} from "./ginmaku-bible-exactness";

const source = {
  counts: { bookNames: 66, verses: 62_000 },
  integrity: {
    bookFingerprint: "books-v2",
    nameFingerprint: "names-v2",
    locationFingerprint: "locations-v2",
    contentFingerprint: "content-v2",
    sampleFingerprint: "sample-v2",
  },
} as const;

const exactTarget: BibleTargetEvidence = {
  books: 66,
  names: 132,
  verses: 62_000,
  ...source.integrity,
};

describe("evaluateBibleExactness", () => {
  it("matches the report v2 count and fingerprint contract", () => {
    expect(evaluateBibleExactness(source, exactTarget)).toMatchInlineSnapshot(`
      {
        "exact": true,
        "sampleExact": true,
      }
    `);
  });

  it.each([
    ["books", 65],
    ["names", 131],
    ["verses", 61_999],
    ["bookFingerprint", "changed"],
    ["nameFingerprint", "changed"],
    ["locationFingerprint", "changed"],
    ["contentFingerprint", "changed"],
  ] satisfies ReadonlyArray<
    readonly [
      keyof BibleTargetEvidence,
      BibleTargetEvidence[keyof BibleTargetEvidence],
    ]
  >)("rejects a changed %s value", (key, value) => {
    expect(
      evaluateBibleExactness(source, { ...exactTarget, [key]: value }),
    ).toEqual({ exact: false, sampleExact: true });
  });

  it("reports a sample mismatch independently", () => {
    expect(
      evaluateBibleExactness(source, {
        ...exactTarget,
        sampleFingerprint: "changed",
      }),
    ).toEqual({ exact: false, sampleExact: false });
  });
});
