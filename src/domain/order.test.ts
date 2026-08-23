import { describe, expect, it } from "vitest";

import { moveBy, moveTo } from "./order";

describe("order utilities", () => {
  it("moves an item to another item's position without mutating input", () => {
    const original = ["a", "b", "c"];
    expect(moveTo(original, "c", "a")).toEqual(["c", "a", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });

  it("moves by one position", () => {
    expect(moveBy(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveBy(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("returns null for missing, identical, or out-of-range moves", () => {
    expect(moveTo(["a", "b"], "a", "a")).toBeNull();
    expect(moveTo(["a", "b"], "missing", "a")).toBeNull();
    expect(moveBy(["a", "b"], "a", -1)).toBeNull();
    expect(moveBy(["a", "b"], "missing", 1)).toBeNull();
  });
});
