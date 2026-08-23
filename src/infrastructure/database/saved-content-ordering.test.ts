import { describe, expect, it } from "vitest";

import { containsExactlySameIds } from "./saved-content-ordering";

describe("containsExactlySameIds", () => {
  it("accepts a permutation of the complete current ID set", () => {
    expect(containsExactlySameIds(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it.each([
    { submitted: ["a", "b"], reason: "missing ID" },
    { submitted: ["a", "b", "foreign"], reason: "foreign ID" },
    { submitted: ["a", "a", "c"], reason: "duplicate ID" },
    { submitted: ["a", "b", "c", "extra"], reason: "extra ID" },
  ])("rejects a $reason", ({ submitted }) => {
    expect(containsExactlySameIds(["a", "b", "c"], submitted)).toBe(false);
  });
});
