import { describe, expect, it } from "vitest";
import {
  parseSlideProjectionQuery,
  parseSlideProjectionState,
  slideProjectionState,
} from "./projection";
const id = "00000000-0000-4000-8000-000000000387";
describe("slide projection coordinates", () => {
  it("accepts only an opaque ID", () => {
    expect(parseSlideProjectionQuery({ id })).toEqual({ id });
  });
  it.each([
    { id: "bad" },
    { id, page: "0" },
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
  it("produces fixed single-surface metadata acknowledgements without body", () => {
    const state = slideProjectionState(id, {
      status: "ready",
      text: "secret synthetic",
      revision: 2,
    });
    expect(parseSlideProjectionState(state)).toEqual({
      id,
      status: "ready",
      page: 0,
      pageCount: 1,
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
          text: null,
          revision: 1,
        }),
      ),
    ).toMatchObject({ status: "stale", page: null, pageCount: 0 });
  });
});
