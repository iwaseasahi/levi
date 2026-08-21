import releasePlan from "../config/initial-release-plan.json";
import {
  ReleasePlanError,
  validateReleasePlan,
} from "../src/operations/release-plan";

try {
  const summary = validateReleasePlan(releasePlan);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  const code =
    error instanceof ReleasePlanError
      ? error.code
      : "RELEASE_PLAN_UNEXPECTED_FAILURE";
  process.stderr.write(`${JSON.stringify({ error: code })}\n`);
  process.exitCode = 1;
}
