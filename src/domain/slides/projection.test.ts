import { describe, expect, it } from "vitest";
import {
  parseSlideProjectionQuery,
  parseSlideProjectionState,
  slideProjectionState,
} from "./projection";
const id = "00000000-0000-4000-8000-000000000387";
describe("slide projection coordinates", () => {
  it("accepts opaque ID and canonical page, defaulting only a missing page", () => {
    expect(parseSlideProjectionQuery({ id })).toEqual({ id, page: 0 });
    expect(parseSlideProjectionQuery({ id, page: "24999" })).toEqual({
      id,
      page: 24999,
    });
  });
  it.each([
    { id: "bad" },
    { id, page: "-1" },
    { id, page: "00" },
    { id, page: "1.5" },
    { id, page: "25000" },
    { id, page: ["1", "2"] },
    { id, churchId: id },
    { id, body: "synthetic" },
  ])("rejects invalid URL coordinates %#", (value) => {
    expect(() => parseSlideProjectionQuery(value)).toThrow();
  });
  it("produces strict metadata acknowledgements without body and validates page bounds", () => {
    const state = slideProjectionState(id, {
      status: "ready",
      pages: ["secret synthetic", "second"],
      page: 1,
      revision: 2,
    });
    expect(parseSlideProjectionState(state)).toEqual({
      id,
      status: "ready",
      page: 1,
      pageCount: 2,
      revision: 2,
    });
    expect(JSON.stringify(state)).not.toContain("synthetic");
    expect(parseSlideProjectionState({ ...state, page: 2 })).toBeNull();
    expect(parseSlideProjectionState({ ...state, body: "x" })).toBeNull();
    expect(parseSlideProjectionState({ ...state, revision: null })).toBeNull();
    expect(
      parseSlideProjectionState(
        slideProjectionState(id, {
          status: "stale",
          pages: [],
          page: 0,
          revision: 1,
        }),
      ),
    ).toMatchObject({ status: "stale", page: null, pageCount: 0 });
  });
});
