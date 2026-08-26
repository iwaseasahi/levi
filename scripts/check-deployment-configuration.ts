import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = (name: string) => path.join(root, "scripts", name);
const deployScript = script("production-deploy.sh");
const entrypoint = script("production-deploy-entrypoint.sh");
const entrypointInstaller = script("install-production-deploy-entrypoint.sh");
const authorizedDeploy = script("run-authorized-production-deploy.sh");
const prepareRelease = script("prepare-production-release.sh");
const deployRelease = script("deploy-production-release.sh");
const waitForRequiredCi = script("wait-for-required-ci.sh");
const healthScript = script("check-production-health.sh");
const secretCheck = script("check-production-secrets.sh");
const bibleImport = script("production-bible-import.sh");
const currentCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).stdout.trim();
const digest = `sha256:${"a".repeat(64)}`;
const authorizationUrl =
  "https://github.com/iwaseasahi/levi/actions/runs/123456";

const syntax = spawnSync(
  "bash",
  [
    "-n",
    deployScript,
    entrypoint,
    entrypointInstaller,
    authorizedDeploy,
    prepareRelease,
    deployRelease,
    waitForRequiredCi,
    healthScript,
    secretCheck,
    bibleImport,
  ],
  { encoding: "utf8" },
);
assert.equal(syntax.status, 0, syntax.stderr);

const ciWaitFixture = mkdtempSync(path.join(tmpdir(), "levi-ci-wait."));
try {
  const fakeGh = path.join(ciWaitFixture, "gh");
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
set -euo pipefail
case "\${FAKE_CI_MODE:-success}" in
  success)
    printf '%s\\n' '{"check_runs":[{"name":"Quality","status":"completed","conclusion":"success","started_at":"1"},{"name":"Database","status":"completed","conclusion":"success","started_at":"1"},{"name":"E2E","status":"completed","conclusion":"success","started_at":"1"},{"name":"Security","status":"completed","conclusion":"success","started_at":"1"}]}'
    ;;
  failure)
    printf '%s\\n' '{"check_runs":[{"name":"Quality","status":"completed","conclusion":"failure","started_at":"1"},{"name":"Database","status":"completed","conclusion":"success","started_at":"1"},{"name":"E2E","status":"completed","conclusion":"success","started_at":"1"},{"name":"Security","status":"completed","conclusion":"success","started_at":"1"}]}'
    ;;
  pending)
    printf '%s\\n' '{"check_runs":[{"name":"Quality","status":"in_progress","conclusion":null,"started_at":"1"}]}'
    ;;
esac
`,
  );
  chmodSync(fakeGh, 0o755);
  const ciWaitEnvironment = {
    ...process.env,
    PATH: `${ciWaitFixture}:${process.env.PATH ?? ""}`,
    LEVI_ALLOW_TEST_OVERRIDES: "true",
    LEVI_CI_WAIT_INTERVAL_SECONDS: "0",
    LEVI_CI_WAIT_MAX_ATTEMPTS: "1",
  };
  const successfulCi = spawnSync("bash", [waitForRequiredCi, "a".repeat(40)], {
    encoding: "utf8",
    env: ciWaitEnvironment,
  });
  assert.equal(successfulCi.status, 0, successfulCi.stderr);

  const failedCi = spawnSync("bash", [waitForRequiredCi, "a".repeat(40)], {
    encoding: "utf8",
    env: { ...ciWaitEnvironment, FAKE_CI_MODE: "failure" },
  });
  assert.equal(failedCi.status, 65);
  assert.match(failedCi.stderr, /Quality check failed/);

  const timedOutCi = spawnSync("bash", [waitForRequiredCi, "a".repeat(40)], {
    encoding: "utf8",
    env: { ...ciWaitEnvironment, FAKE_CI_MODE: "pending" },
  });
  assert.equal(timedOutCi.status, 75);
  assert.match(timedOutCi.stderr, /Timed out waiting for required CI/);
} finally {
  rmSync(ciWaitFixture, { recursive: true, force: true });
}

const baseEnvironment = {
  ...process.env,
  LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
  LEVI_ALLOW_TEST_OVERRIDES: "true",
  LEVI_DEPLOY_APPROVAL_REFERENCE: authorizationUrl,
  LEVI_DEPLOY_COMMIT: currentCommit,
  LEVI_DEPLOY_DRY_RUN: "true",
  LEVI_DEPLOY_REPOSITORY: root,
  LEVI_IMAGE: `ghcr.io/iwaseasahi/levi@${digest}`,
  LEVI_MIGRATION_IMAGE: `ghcr.io/iwaseasahi/levi-migrate@${digest}`,
};

const weekday = spawnSync("bash", [deployScript], {
  cwd: root,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "5" },
});
assert.equal(weekday.status, 0, weekday.stderr);

const sunday = spawnSync("bash", [deployScript], {
  cwd: root,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "7" },
});
assert.notEqual(sunday.status, 0);
assert.match(sunday.stderr, /Sunday-authorized Actions run URL/);

const approvedSunday = spawnSync("bash", [deployScript], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...baseEnvironment,
    LEVI_DEPLOY_WEEKDAY_OVERRIDE: "7",
    LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE: authorizationUrl,
  },
});
assert.equal(approvedSunday.status, 0, approvedSunday.stderr);

const weekdayWithSundayApproval = spawnSync("bash", [deployScript], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...baseEnvironment,
    LEVI_DEPLOY_WEEKDAY_OVERRIDE: "5",
    LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE: authorizationUrl,
  },
});
assert.notEqual(weekdayWithSundayApproval.status, 0);
assert.match(
  weekdayWithSundayApproval.stderr,
  /must not be supplied outside Sunday/,
);

const malformedAuthorization = spawnSync("bash", [deployScript], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...baseEnvironment,
    LEVI_DEPLOY_APPROVAL_REFERENCE:
      "https://github.com/iwaseasahi/levi/issues/1",
    LEVI_DEPLOY_WEEKDAY_OVERRIDE: "5",
  },
});
assert.notEqual(malformedAuthorization.status, 0);
assert.match(
  malformedAuthorization.stderr,
  /authorized GitHub Actions run URL/,
);

const deployWorkflow = readFileSync(
  path.join(root, ".github/workflows/deploy-production.yml"),
  "utf8",
);
for (const check of ["Quality", "Database", "E2E", "Security"]) {
  assert.match(deployWorkflow, new RegExp(`for required in.*${check}`, "s"));
}
assert.match(deployWorkflow, /environment: production\n/);
assert.match(deployWorkflow, /environment: production-sunday/);
assert.match(deployWorkflow, /needs\.verify\.outputs\.is_sunday == 'true'/);
assert.match(deployWorkflow, /actions: read/);
assert.match(deployWorkflow, /gh run download/);
assert.match(deployWorkflow, /schema_version: 4/);
assert.match(deployWorkflow, /authorization_run_url/);
assert.match(deployWorkflow, /retention-days: 1/);
assert.doesNotMatch(deployWorkflow, /issues: read/);
assert.doesNotMatch(deployWorkflow, /issuecomment/);
assert.doesNotMatch(deployWorkflow, /\bssh\b/);
assert.doesNotMatch(deployWorkflow, /^\s+push:/m);

const publishWorkflow = readFileSync(
  path.join(root, ".github/workflows/publish-production-images.yml"),
  "utf8",
);
assert.match(
  publishWorkflow,
  /run-name: "Prepare production candidate for \$\{\{ inputs\.commit_sha \}\}"/,
);
assert.match(publishWorkflow, /production-release-candidate\.json/);
assert.match(publishWorkflow, /retention-days: 1/);
assert.doesNotMatch(publishWorkflow, /release_issue/);
assert.doesNotMatch(publishWorkflow, /\bssh\b/);

const prepareSource = readFileSync(prepareRelease, "utf8");
assert.match(prepareSource, /\$# -ne 0/);
assert.match(prepareSource, /git rev-parse origin\/main/);
assert.match(prepareSource, /wait-for-required-ci\.sh/);
assert.match(prepareSource, /production:release:deploy/);
assert.doesNotMatch(prepareSource, /ISSUE_NUMBER|gh issue|release_issue/);
assert.doesNotMatch(prepareSource, /ssh /);

const deployReleaseSource = readFileSync(deployRelease, "utf8");
assert.match(deployReleaseSource, /release_candidate_run_id/);
assert.match(deployReleaseSource, /run-authorized-production-deploy\.sh/);
assert.doesNotMatch(
  deployReleaseSource,
  /gh issue|approval_comment|release_issue/,
);

const authorizedSource = readFileSync(authorizedDeploy, "utf8");
assert.match(authorizedSource, /\.schema_version == 4/);
assert.match(authorizedSource, /authorization_run_url/);
assert.match(authorizedSource, /ssh -o BatchMode=yes/);
assert.doesNotMatch(authorizedSource, /issuecomment/);

const authorizationFixture = mkdtempSync(
  path.join(tmpdir(), "levi-deploy-authorization."),
);
try {
  const fakeGh = path.join(authorizationFixture, "gh");
  const fakeSsh = path.join(authorizationFixture, "ssh");
  const record = path.join(authorizationFixture, "authorization.json");
  const capture = path.join(authorizationFixture, "ssh-arguments.txt");
  const runId = 123456;
  const runAttempt = 2;
  const validRecord = {
    schema_version: 4,
    repository: "iwaseasahi/levi",
    run_id: runId,
    run_attempt: runAttempt,
    commit_sha: "a".repeat(40),
    application_image: `ghcr.io/iwaseasahi/levi@sha256:${"b".repeat(64)}`,
    migration_image: `ghcr.io/iwaseasahi/levi-migrate@sha256:${"c".repeat(64)}`,
    authorization_run_url: authorizationUrl,
    sunday_authorization_run_url: null,
    release_candidate_run_id: 987654,
    authorized_at: "2026-08-25T00:00:00Z",
  };
  writeFileSync(record, JSON.stringify(validRecord));
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "api" ]]; then
  case "$2" in
    */actions/runs/*)
      printf '{"event":"workflow_dispatch","status":"completed","conclusion":"%s","head_branch":"main","workflow_id":99,"run_attempt":${runAttempt}}\\n' "\${FAKE_RUN_CONCLUSION:-success}"
      exit 0
      ;;
    */actions/workflows/*)
      printf '.github/workflows/deploy-production.yml\\n'
      exit 0
      ;;
  esac
elif [[ "$1" == "run" ]]; then
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--dir" ]]; then cp "$AUTHORIZATION_FIXTURE" "$2/production-deploy-authorization.json"; exit 0; fi
    shift
  done
fi
echo "unexpected gh: $*" >&2
exit 70
`,
  );
  writeFileSync(
    fakeSsh,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" > "$SSH_CAPTURE"
`,
  );
  chmodSync(fakeGh, 0o755);
  chmodSync(fakeSsh, 0o755);
  const fixtureEnvironment = {
    ...process.env,
    PATH: `${authorizationFixture}:${process.env.PATH ?? ""}`,
    AUTHORIZATION_FIXTURE: record,
    SSH_CAPTURE: capture,
  };
  const authorized = spawnSync("bash", [authorizedDeploy, `${runId}`], {
    cwd: root,
    encoding: "utf8",
    env: fixtureEnvironment,
  });
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.match(readFileSync(capture, "utf8"), /actions\/runs\/123456/);
  assert.match(readFileSync(capture, "utf8"), /'none'/);

  writeFileSync(
    record,
    JSON.stringify({
      ...validRecord,
      authorization_run_url: "https://example.com/tampered",
    }),
  );
  const tampered = spawnSync("bash", [authorizedDeploy, `${runId}`], {
    cwd: root,
    encoding: "utf8",
    env: fixtureEnvironment,
  });
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /authorization record is invalid/);
} finally {
  rmSync(authorizationFixture, { recursive: true, force: true });
}

const entrypointSource = readFileSync(entrypoint, "utf8");
assert.match(entrypointSource, /AUTHORIZATION_RUN_URL/);
assert.match(entrypointSource, /actions\/runs/);
assert.match(entrypointSource, /\$#" -ne 5/);
assert.match(entrypointSource, /merge-base --is-ancestor/);
assert.doesNotMatch(entrypointSource, /issuecomment/);

const installerSource = readFileSync(entrypointInstaller, "utf8");
assert.match(installerSource, /visudo -cf/);
assert.match(installerSource, /NOPASSWD: %s.*entrypoint_target/);
assert.doesNotMatch(installerSource, /NOPASSWD:.*(?:git|env|docker|bash|sh\b)/);

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

const secretSource = readFileSync(secretCheck, "utf8");
assert.match(
  secretSource,
  /Production secret configuration passed without disclosing values/,
);
assert.match(secretSource, /postgres_password.*!=.*app_password/s);
assert.match(secretSource, /ADMIN_BASIC_AUTH_PASSWORD_HASH/);
assert.doesNotMatch(secretSource, /set -x/);

const bibleImportSource = readFileSync(bibleImport, "utf8");
assert.match(bibleImportSource, /LEVI_IMPORT_APPROVAL_REFERENCE/);
assert.match(bibleImportSource, /frozen on Sunday/);
assert.match(bibleImportSource, /production-backup\.sh/);
assert.doesNotMatch(bibleImportSource, /set -x/);

console.log("Production deployment configuration passed safety invariants.");
