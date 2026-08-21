import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const deployScript = path.join(repositoryRoot, "scripts/production-deploy.sh");
const healthScript = path.join(
  repositoryRoot,
  "scripts/check-production-health.sh",
);
const currentCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).stdout.trim();
const digest = `sha256:${"a".repeat(64)}`;
const baseEnvironment = {
  ...process.env,
  LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
  LEVI_ALLOW_TEST_OVERRIDES: "true",
  LEVI_DEPLOY_APPROVAL_REFERENCE:
    "https://github.com/iwaseasahi/levi/issues/87#issuecomment-123",
  LEVI_DEPLOY_COMMIT: currentCommit,
  LEVI_DEPLOY_DRY_RUN: "true",
  LEVI_DEPLOY_REPOSITORY: repositoryRoot,
  LEVI_IMAGE: `ghcr.io/iwaseasahi/levi@${digest}`,
  LEVI_MIGRATION_IMAGE: `ghcr.io/iwaseasahi/levi-migrate@${digest}`,
};

const syntax = spawnSync("bash", ["-n", deployScript, healthScript], {
  encoding: "utf8",
});
assert.equal(syntax.status, 0, syntax.stderr);

const weekday = spawnSync("bash", [deployScript], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "5" },
});
assert.equal(weekday.status, 0, weekday.stderr);

const sunday = spawnSync("bash", [deployScript], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "7" },
});
assert.notEqual(sunday.status, 0);
assert.match(sunday.stderr, /frozen on Sunday/);

const deployWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/deploy-production.yml"),
  "utf8",
);
for (const checkName of ["Quality", "Database", "E2E", "Security"]) {
  assert.match(
    deployWorkflow,
    new RegExp(`for required in.*${checkName}`, "s"),
  );
}
assert.match(deployWorkflow, /environment: production/);
assert.match(deployWorkflow, /workflow_dispatch:/);
assert.doesNotMatch(deployWorkflow, /^\s+push:/m);

const healthSource = readFileSync(healthScript, "utf8");
for (const signal of [
  "/api/ready",
  "pg_isready",
  "check-production-backups.sh",
  "df -Pk /",
  "free -m",
  "five_xx_count",
]) {
  assert(healthSource.includes(signal), `Missing health signal: ${signal}`);
}

console.log("Production deployment configuration passed safety invariants.");
