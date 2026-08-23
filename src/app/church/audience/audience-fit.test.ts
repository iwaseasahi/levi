import { describe, expect, it } from "vitest";
import { calculateAudienceFitScale } from "./audience-fit";

describe("audience fit scale", () => {
  it("keeps content that already fits at full scale", () => {
    expect(
      calculateAudienceFitScale({
        availableHeight: 500,
        availableWidth: 800,
        contentHeight: 400,
        contentWidth: 700,
      }),
    ).toBe(1);
  });

  it("rounds down to the first five-percent step that fits", () => {
    const scale = calculateAudienceFitScale({
      availableHeight: 500,
      availableWidth: 800,
      contentHeight: 1_000,
      contentWidth: 400,
    });
    expect(scale).toBeLessThanOrEqual(0.5);
    expect(scale / 0.95).toBeGreaterThan(0.5);
  });

  it("retains the existing lower fitting bound for extreme content", () => {
    expect(
      calculateAudienceFitScale({
        availableHeight: 1,
        availableWidth: 1,
        contentHeight: 10_000,
        contentWidth: 10_000,
      }),
    ).toBeCloseTo(0.1937, 3);
  });
});
