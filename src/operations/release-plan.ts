const expectedGateIds = [
  "deployment-selection",
  "release-window",
  "backup-restore",
  "production-secrets",
  "production-migration",
  "traffic-cutover",
  "external-communication",
] as const;

const expectedSteps = [
  "confirm-target-and-approvals",
  "announce-maintenance-window",
  "freeze-approved-source",
  "capture-production-backup",
  "prove-backup-restore",
  "apply-schema-migrations",
  "stage-application-without-traffic",
  "import-and-reconcile-bible",
  "provision-approved-operators-and-churches",
  "run-smoke-and-readiness",
  "approve-and-enable-traffic",
  "observe-stabilization-window",
  "send-completion-notice",
] as const;

const expectedStopConditions = [
  "approval-or-target-mismatch",
  "backup-or-restore-proof-failed",
  "source-fingerprint-or-rights-mismatch",
  "schema-migration-failed",
  "bible-reconciliation-not-exact",
  "readiness-or-smoke-failed",
  "restricted-data-in-logs-or-artifacts",
  "unowned-critical-alert",
] as const;

export class ReleasePlanError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ReleasePlanError";
  }
}

type RecordValue = Record<string, unknown>;

function record(value: unknown, code: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ReleasePlanError(code);
  return value as RecordValue;
}

function stringArray(value: unknown, code: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new ReleasePlanError(code);
  return value as string[];
}

function exactOrder(
  actual: string[],
  expected: readonly string[],
  code: string,
) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  )
    throw new ReleasePlanError(code);
}

export function validateReleasePlan(value: unknown) {
  const plan = record(value, "RELEASE_PLAN_INVALID");
  if (plan.formatVersion !== 1)
    throw new ReleasePlanError("RELEASE_PLAN_VERSION_UNSUPPORTED");
  if (plan.productionExecuted !== false)
    throw new ReleasePlanError("RELEASE_PLAN_PRODUCTION_EXECUTION_FORBIDDEN");

  const strategy = record(plan.strategy, "RELEASE_PLAN_STRATEGY_MISSING");
  if (
    strategy.candidate !== "single-cutover" ||
    strategy.status !== "pending-human-approval" ||
    strategy.decisionIssue !== "https://github.com/iwaseasahi/levi/issues/81"
  )
    throw new ReleasePlanError("RELEASE_PLAN_STRATEGY_NOT_GATED");

  const objectives = record(plan.objectives, "RELEASE_PLAN_OBJECTIVES_MISSING");
  if (
    objectives.status !== "pending-human-approval" ||
    typeof objectives.rpoMinutes !== "number" ||
    objectives.rpoMinutes > 60 ||
    objectives.rpoMinutes <= 0 ||
    typeof objectives.rtoMinutes !== "number" ||
    objectives.rtoMinutes > 120 ||
    objectives.rtoMinutes <= 0
  )
    throw new ReleasePlanError("RELEASE_PLAN_OBJECTIVES_INVALID");

  if (!Array.isArray(plan.humanGates))
    throw new ReleasePlanError("RELEASE_PLAN_HUMAN_GATES_MISSING");
  const gates = plan.humanGates.map((value) =>
    record(value, "RELEASE_PLAN_HUMAN_GATE_INVALID"),
  );
  exactOrder(
    gates.map(({ id }) => (typeof id === "string" ? id : "")),
    expectedGateIds,
    "RELEASE_PLAN_HUMAN_GATES_INCOMPLETE",
  );
  if (
    gates.some(
      ({ issue, requiredBefore, status }) =>
        status !== "pending" ||
        (issue !== 58 && issue !== 81) ||
        typeof requiredBefore !== "string" ||
        !requiredBefore,
    )
  )
    throw new ReleasePlanError("RELEASE_PLAN_HUMAN_GATE_NOT_PENDING");

  exactOrder(
    stringArray(plan.steps, "RELEASE_PLAN_STEPS_MISSING"),
    expectedSteps,
    "RELEASE_PLAN_STEP_ORDER_INVALID",
  );
  exactOrder(
    stringArray(plan.stopConditions, "RELEASE_PLAN_STOP_CONDITIONS_MISSING"),
    expectedStopConditions,
    "RELEASE_PLAN_STOP_CONDITIONS_INCOMPLETE",
  );
  if (stringArray(plan.smokeChecks, "RELEASE_PLAN_SMOKE_MISSING").length < 9)
    throw new ReleasePlanError("RELEASE_PLAN_SMOKE_INCOMPLETE");
  if (
    stringArray(plan.monitoringSignals, "RELEASE_PLAN_MONITORING_MISSING")
      .length < 8
  )
    throw new ReleasePlanError("RELEASE_PLAN_MONITORING_INCOMPLETE");
  const communications = record(
    plan.communications,
    "RELEASE_PLAN_COMMUNICATIONS_MISSING",
  );
  if (
    typeof communications.beforeTemplate !== "string" ||
    !communications.beforeTemplate.includes("最新版Chrome") ||
    typeof communications.afterTemplate !== "string" ||
    !communications.afterTemplate.includes("最新版Chrome")
  )
    throw new ReleasePlanError("RELEASE_PLAN_COMMUNICATIONS_INCOMPLETE");
  if (
    stringArray(plan.localEvidence, "RELEASE_PLAN_EVIDENCE_MISSING").length < 5
  )
    throw new ReleasePlanError("RELEASE_PLAN_EVIDENCE_INCOMPLETE");

  const serialized = JSON.stringify(plan).toLowerCase();
  if (
    serialized.includes("postgresql://") ||
    serialized.includes("api_key") ||
    serialized.includes("password=")
  )
    throw new ReleasePlanError("RELEASE_PLAN_SENSITIVE_VALUE_FORBIDDEN");

  return {
    formatVersion: 1,
    result: "prepared-with-human-gates" as const,
    productionExecuted: false,
    candidateStrategy: strategy.candidate,
    rpoMinutes: objectives.rpoMinutes,
    rtoMinutes: objectives.rtoMinutes,
    pendingHumanGates: gates.length,
    orderedSteps: expectedSteps.length,
    stopConditions: expectedStopConditions.length,
    smokeChecks: (plan.smokeChecks as string[]).length,
    monitoringSignals: (plan.monitoringSignals as string[]).length,
    walkthrough: expectedSteps.map((id, index) => ({
      order: index + 1,
      id,
      state: "prepared" as const,
    })),
  };
}
