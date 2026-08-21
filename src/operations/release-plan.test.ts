import { describe, expect, it } from "vitest";
import releasePlan from "../../config/initial-release-plan.json";
import { validateReleasePlan } from "./release-plan";

function plan() {
  return structuredClone(releasePlan) as Record<string, unknown>;
}

describe("initial-release operations plan", () => {
  it("accepts the prepared plan without implying production approval", () => {
    const result = validateReleasePlan(plan());
    expect(result).toMatchObject({
      candidateStrategy: "single-cutover",
      formatVersion: 1,
      monitoringSignals: 8,
      orderedSteps: 13,
      pendingHumanGates: 7,
      productionExecuted: false,
      result: "prepared-with-human-gates",
      rpoMinutes: 60,
      rtoMinutes: 120,
      smokeChecks: 9,
      stopConditions: 8,
    });
    expect(result.walkthrough).toHaveLength(13);
    expect(result.walkthrough[0]).toEqual({
      id: "confirm-target-and-approvals",
      order: 1,
      state: "prepared",
    });
    expect(result.walkthrough.at(-1)).toEqual({
      id: "send-completion-notice",
      order: 13,
      state: "prepared",
    });
  });

  it("rejects production execution and prematurely approved gates", () => {
    const executed = plan();
    executed.productionExecuted = true;
    expect(() => validateReleasePlan(executed)).toThrow(
      "RELEASE_PLAN_PRODUCTION_EXECUTION_FORBIDDEN",
    );

    const approved = plan();
    (approved.humanGates as Array<Record<string, unknown>>)[0]!.status =
      "approved";
    expect(() => validateReleasePlan(approved)).toThrow(
      "RELEASE_PLAN_HUMAN_GATE_NOT_PENDING",
    );
  });

  it("rejects reordered cutover steps and weakened recovery objectives", () => {
    const reordered = plan();
    (reordered.steps as unknown[]).reverse();
    expect(() => validateReleasePlan(reordered)).toThrow(
      "RELEASE_PLAN_STEP_ORDER_INVALID",
    );

    const weakened = plan();
    (weakened.objectives as Record<string, unknown>).rpoMinutes = 1440;
    expect(() => validateReleasePlan(weakened)).toThrow(
      "RELEASE_PLAN_OBJECTIVES_INVALID",
    );
  });

  it("rejects connection strings or credential-shaped values", () => {
    const unsafe = plan();
    (unsafe.communications as Record<string, unknown>).afterTemplate =
      "最新版Chrome postgresql://example.invalid/database";
    expect(() => validateReleasePlan(unsafe)).toThrow(
      "RELEASE_PLAN_SENSITIVE_VALUE_FORBIDDEN",
    );
  });
});
