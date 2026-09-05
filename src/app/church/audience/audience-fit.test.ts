import { describe, expect, it } from "vitest";
import { findAudienceFitScale } from "./audience-fit";

describe("audience fit scale", () => {
  it("keeps content that already fits at full scale", () => {
    const measuredScales: number[] = [];

    expect(
      findAudienceFitScale((scale) => {
        measuredScales.push(scale);
        return true;
      }),
    ).toBe(1);
    expect(measuredScales).toEqual([1]);
  });

  it("selects the largest five-percent step that actually fits", () => {
    const measuredScales: number[] = [];
    const scale = findAudienceFitScale((candidate) => {
      measuredScales.push(candidate);
      return candidate <= 0.5;
    });

    expect(scale).toBeLessThanOrEqual(0.5);
    expect(scale / 0.95).toBeGreaterThan(0.5);
    expect(measuredScales.at(-1)).toBe(scale);
  });

  it("retains a finite lower fitting bound for extreme content", () => {
    expect(findAudienceFitScale(() => false)).toBeCloseTo(0.0994, 3);
  });
});
