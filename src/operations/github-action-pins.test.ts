import { describe, expect, it } from "vitest";

import {
  assertReviewedActionUses,
  reviewedActionPins,
} from "../../scripts/lib/github-action-pins";

const oldPin = reviewedActionPins["pnpm/setup"]["v2.1.0"];
const newPin = reviewedActionPins["pnpm/setup"]["v3.1.1"];
const step = (pin: string, version = "v3.1.1") =>
  `      - uses: pnpm/setup@${pin} # ${version}\n`;

describe("reviewed GitHub Action pins", () => {
  for (const action of Object.keys(reviewedActionPins) as Array<
    keyof typeof reviewedActionPins
  >) {
    for (const [release, sha] of Object.entries(reviewedActionPins[action])) {
      it(`accepts the reviewed ${action} ${release} in every job`, () => {
        const source = `      - uses: ${action}@${sha} # ${release}\n`.repeat(
          4,
        );
        expect(() => assertReviewedActionUses(source, action, 4)).not.toThrow();
      });
    }
  }

  it.each([
    ["unreviewed full SHA", step("f".repeat(40))],
    ["short SHA", step(newPin.slice(0, 7))],
    ["moving tag", step("v3.1.1")],
    ["moving branch", step("main")],
    ["wrong release comment", step(newPin, "v99.0.0")],
    ["old release paired with new SHA", step(newPin, "v2.1.0")],
    ["missing release comment", `- uses: pnpm/setup@${newPin}\n`],
    ["different action owner", `- uses: unreviewed/setup@${newPin} # v3.1.1\n`],
    [
      "comment instead of executable step",
      `# uses: pnpm/setup@${newPin} # v3.1.1\n`,
    ],
  ])("rejects %s", (_label, source) => {
    expect(() => assertReviewedActionUses(source, "pnpm/setup", 1)).toThrow();
  });

  it("rejects mixed reviewed releases across jobs", () => {
    expect(() =>
      assertReviewedActionUses(
        step(oldPin, "v2.1.0") + step(newPin),
        "pnpm/setup",
        2,
      ),
    ).toThrow("all jobs must use the same reviewed pin");
  });

  it("rejects missing or additional setup steps", () => {
    for (const source of [step(newPin), step(newPin).repeat(3)]) {
      expect(() => assertReviewedActionUses(source, "pnpm/setup", 2)).toThrow(
        "unexpected step count",
      );
    }
  });

  it("requires a positive integer step count", () => {
    for (const count of [0, -1, 1.5]) {
      expect(() => assertReviewedActionUses("", "pnpm/setup", count)).toThrow();
    }
  });
});
