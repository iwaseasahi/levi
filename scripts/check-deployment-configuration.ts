import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
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
const waitForProductionAuthorization = script(
  "wait-for-production-authorization.sh",
);
const healthScript = script("check-production-health.sh");
const secretCheck = script("check-production-secrets.sh");
const bibleImport = script("production-bible-import.sh");
const ghcrCleanup = script("cleanup-ghcr-packages.sh");
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
    waitForProductionAuthorization,
    healthScript,
    secretCheck,
    bibleImport,
    ghcrCleanup,
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
assert.doesNotMatch(deployWorkflow, /environment: production\n/);
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
assert.match(
  publishWorkflow,
  /docker\/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e/,
);
assert.equal(
  publishWorkflow.match(
    /docker\/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e/g,
  )?.length,
  2,
);
assert.equal(
  publishWorkflow.match(
    /docker\/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a/g,
  )?.length,
  2,
);
assert.match(
  publishWorkflow,
  /cache-from: type=gha,scope=levi-production-application/,
);
assert.match(
  publishWorkflow,
  /cache-to: type=gha,mode=max,scope=levi-production-application/,
);
assert.match(
  publishWorkflow,
  /cache-from: type=gha,scope=levi-production-migration/,
);
assert.match(
  publishWorkflow,
  /cache-to: type=gha,mode=max,scope=levi-production-migration/,
);
assert.match(
  publishWorkflow,
  /application:\n\s+name: Build application image[\s\S]*?needs: verify[\s\S]*?digest: \$\{\{ steps\.build\.outputs\.digest \}\}/,
);
assert.match(
  publishWorkflow,
  /migration:\n\s+name: Build migration image[\s\S]*?needs: verify[\s\S]*?digest: \$\{\{ steps\.build\.outputs\.digest \}\}/,
);
assert.match(
  publishWorkflow,
  /candidate:\n\s+name: Create immutable release candidate[\s\S]*?needs:\n\s+- application\n\s+- migration/,
);
assert.match(
  publishWorkflow,
  /APPLICATION_DIGEST: \$\{\{ needs\.application\.outputs\.digest \}\}/,
);
assert.match(
  publishWorkflow,
  /MIGRATION_DIGEST: \$\{\{ needs\.migration\.outputs\.digest \}\}/,
);
assert.doesNotMatch(publishWorkflow, /docker buildx build/);
assert.doesNotMatch(publishWorkflow, /release_issue/);
assert.doesNotMatch(publishWorkflow, /\bssh\b/);

const cleanupWorkflow = readFileSync(
  path.join(root, ".github/workflows/cleanup-ghcr.yml"),
  "utf8",
);
assert.match(cleanupWorkflow, /cron: "0 5 \* \* 1"/);
assert.match(cleanupWorkflow, /workflow_dispatch:/);
assert.match(cleanupWorkflow, /packages: write/);
assert.match(cleanupWorkflow, /LEVI_PRODUCTION_DEPLOYMENT_JSON/);
assert.match(cleanupWorkflow, /vars\.LEVI_PRODUCTION_DEPLOYMENT/);
assert.match(cleanupWorkflow, /LEVI_GHCR_RETENTION_DAYS: "7"/);
assert.doesNotMatch(cleanupWorkflow, /pull_request:|\bssh\b/);

const cleanupFixture = mkdtempSync(path.join(tmpdir(), "levi-ghcr-cleanup."));
try {
  const fakeGh = path.join(cleanupFixture, "gh");
  const fakeDate = path.join(cleanupFixture, "date");
  const deletedVersions = path.join(cleanupFixture, "deleted.txt");
  writeFileSync(
    fakeDate,
    `#!/usr/bin/env bash
printf '%s\\n' '2026-08-19T00:00:00Z'
`,
  );
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"/levi-migrate/versions?"* ]]; then
  printf '%s\\n' '[[{"id":11,"name":"sha256:${"b".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":["current"]}}},{"id":12,"name":"sha256:${"d".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":["old"]}}},{"id":13,"name":"sha256:${"e".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":[]}}}]]'
elif [[ "$*" == *"/levi/versions?"* ]]; then
  printf '%s\\n' '[[{"id":1,"name":"sha256:${"a".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":["current"]}}},{"id":2,"name":"sha256:${"c".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":["old"]}}},{"id":3,"name":"sha256:${"e".repeat(64)}","created_at":"2026-08-20T00:00:00Z","metadata":{"container":{"tags":["recent"]}}},{"id":4,"name":"sha256:${"f".repeat(64)}","created_at":"2026-07-01T00:00:00Z","metadata":{"container":{"tags":[]}}}]]'
elif [[ "$*" == *"--method DELETE"* ]]; then
  printf '%s\\n' "$*" >> "$DELETED_VERSIONS"
else
  echo "unexpected gh: $*" >&2
  exit 70
fi
`,
  );
  chmodSync(fakeGh, 0o755);
  chmodSync(fakeDate, 0o755);
  const deploymentState = JSON.stringify({
    schema_version: 1,
    status: "ready",
    commit_sha: "f".repeat(40),
    application_image: `ghcr.io/iwaseasahi/levi@sha256:${"a".repeat(64)}`,
    migration_image: `ghcr.io/iwaseasahi/levi-migrate@sha256:${"b".repeat(64)}`,
    authorization_run_url:
      "https://github.com/iwaseasahi/levi/actions/runs/123456",
    recorded_at: "2026-08-18T00:00:00Z",
  });
  const cleanupEnvironment = {
    ...process.env,
    PATH: `${cleanupFixture}:${process.env.PATH ?? ""}`,
    DELETED_VERSIONS: deletedVersions,
    LEVI_PRODUCTION_DEPLOYMENT_JSON: deploymentState,
  };
  const dryRun = spawnSync("bash", [ghcrCleanup], {
    cwd: root,
    encoding: "utf8",
    env: cleanupEnvironment,
  });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /would-delete package=levi .*version_id=2/);
  assert.match(
    dryRun.stdout,
    /would-delete package=levi-migrate .*version_id=12/,
  );
  assert.match(dryRun.stdout, /reason=production/);
  assert.match(dryRun.stdout, /reason=untagged-child-or-attestation/);
  assert.equal(existsSync(deletedVersions), false);

  const cleanup = spawnSync("bash", [ghcrCleanup], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...cleanupEnvironment,
      LEVI_GHCR_CLEANUP_DRY_RUN: "false",
    },
  });
  assert.equal(cleanup.status, 0, cleanup.stderr);
  const deletions = readFileSync(deletedVersions, "utf8");
  assert.match(deletions, /\/levi\/versions\/2/);
  assert.match(deletions, /\/levi-migrate\/versions\/12/);
  assert.doesNotMatch(deletions, /versions\/(?:1|3|4|11|13)(?:\D|$)/);

  const blocked = spawnSync("bash", [ghcrCleanup], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...cleanupEnvironment,
      LEVI_PRODUCTION_DEPLOYMENT_JSON: deploymentState.replace(
        '"status":"ready"',
        '"status":"deploying"',
      ),
    },
  });
  assert.equal(blocked.status, 65);
  assert.match(blocked.stderr, /no package version was deleted/);
} finally {
  rmSync(cleanupFixture, { recursive: true, force: true });
}

const migrationDockerfile = readFileSync(
  path.join(root, "Dockerfile.migrate.production"),
  "utf8",
);
assert.match(migrationDockerfile, /@levi\/production-migration/);
assert.match(migrationDockerfile, /deploy --prod \/migrator/);
assert.doesNotMatch(migrationDockerfile, /import-ginmaku-bible/);
assert.doesNotMatch(migrationDockerfile, /run-production-bible-import/);
assert.doesNotMatch(migrationDockerfile, /src\/migration/);

const deploySource = readFileSync(deployScript, "utf8");
assert.match(
  deploySource,
  /docker pull "\$application_image" &.*docker pull "\$migration_image" &/s,
);
assert.match(deploySource, /wait "\$application_pull_pid"/);
assert.match(deploySource, /wait "\$migration_pull_pid"/);
assert.match(
  deploySource,
  /Approved application and migration images are available locally/,
);

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
assert.match(deployReleaseSource, /wait-for-production-authorization\.sh/);
assert.match(deployReleaseSource, /Production deployが正常に完了しました/);
assert.match(deployReleaseSource, /Authorization: https:\/\/github\.com/);
assert.match(deployReleaseSource, /\$\{1:-\}.*==.*--/);
assert.doesNotMatch(
  deployReleaseSource,
  /gh issue|approval_comment|release_issue/,
);

const authorizationWaitFixture = mkdtempSync(
  path.join(tmpdir(), "levi-authorization-wait."),
);
try {
  const fakeGh = path.join(authorizationWaitFixture, "gh");
  const marker = path.join(authorizationWaitFixture, "polled");
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
set -euo pipefail
endpoint="$2"
if [[ "$endpoint" == */pending_deployments ]]; then
  printf '%s\n' '[{"environment":{"name":"production-sunday"}}]'
elif [[ "\${FAKE_AUTHORIZATION_RESULT:-success}" == "failure" ]]; then
  printf '%s\n' '{"status":"completed","conclusion":"failure"}'
elif [[ -f "$POLL_MARKER" ]]; then
  printf '%s\n' '{"status":"completed","conclusion":"success"}'
else
  : > "$POLL_MARKER"
  printf '%s\n' '{"status":"waiting","conclusion":null}'
fi
`,
  );
  chmodSync(fakeGh, 0o755);
  const waitEnvironment = {
    ...process.env,
    PATH: `${authorizationWaitFixture}:${process.env.PATH ?? ""}`,
    POLL_MARKER: marker,
    LEVI_AUTHORIZATION_WAIT_INTERVAL_SECONDS: "0",
  };
  const approved = spawnSync(
    "bash",
    [waitForProductionAuthorization, "123456"],
    { cwd: root, encoding: "utf8", env: waitEnvironment },
  );
  assert.equal(approved.status, 0, approved.stderr);
  assert.match(
    approved.stdout,
    /production-sunday Environment の日曜deploy承認を待っています/,
  );
  assert.match(
    approved.stdout,
    /承認URL: https:\/\/github\.com\/iwaseasahi\/levi\/actions\/runs\/123456/,
  );
  assert.match(approved.stdout, /production検証が完了しました/);

  const rejected = spawnSync(
    "bash",
    [waitForProductionAuthorization, "123456"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...waitEnvironment, FAKE_AUTHORIZATION_RESULT: "failure" },
    },
  );
  assert.equal(rejected.status, 65);
  assert.match(rejected.stderr, /completed with: failure/);
  assert.match(rejected.stderr, /actions\/runs\/123456/);
} finally {
  rmSync(authorizationWaitFixture, { recursive: true, force: true });
}

const authorizedSource = readFileSync(authorizedDeploy, "utf8");
assert.match(authorizedSource, /\.schema_version == 4/);
assert.match(authorizedSource, /authorization_run_url/);
assert.match(authorizedSource, /ssh -o BatchMode=yes/);
assert.match(authorizedSource, /\$\{1:-\}.*==.*--/);
assert.match(authorizedSource, /record_deployment_state "deploying"/);
assert.match(authorizedSource, /record_deployment_state "ready"/);
assert.match(authorizedSource, /gh variable set LEVI_PRODUCTION_DEPLOYMENT/);
assert.doesNotMatch(authorizedSource, /issuecomment/);

const releaseArgumentFixture = mkdtempSync(
  path.join(tmpdir(), "levi-release-arguments."),
);
try {
  const fakeGh = path.join(releaseArgumentFixture, "gh");
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
exit 70
`,
  );
  chmodSync(fakeGh, 0o755);
  const fixtureEnvironment = {
    ...process.env,
    PATH: `${releaseArgumentFixture}:${process.env.PATH ?? ""}`,
  };
  for (const arguments_ of [["123456"], ["--", "123456"]]) {
    const accepted = spawnSync("bash", [deployRelease, ...arguments_], {
      cwd: root,
      encoding: "utf8",
      env: fixtureEnvironment,
    });
    assert.equal(accepted.status, 70, accepted.stderr);
    assert.doesNotMatch(accepted.stderr, /Usage:/);
  }
  for (const arguments_ of [[], ["--"], ["--", "invalid"], ["1", "2"]]) {
    const rejected = spawnSync("bash", [deployRelease, ...arguments_], {
      cwd: root,
      encoding: "utf8",
      env: fixtureEnvironment,
    });
    assert.equal(rejected.status, 64);
    assert.match(rejected.stderr, /Usage:/);
  }
} finally {
  rmSync(releaseArgumentFixture, { recursive: true, force: true });
}

const authorizationFixture = mkdtempSync(
  path.join(tmpdir(), "levi-deploy-authorization."),
);
try {
  const fakeGh = path.join(authorizationFixture, "gh");
  const fakeSsh = path.join(authorizationFixture, "ssh");
  const record = path.join(authorizationFixture, "authorization.json");
  const capture = path.join(authorizationFixture, "ssh-arguments.txt");
  const variableCapture = path.join(
    authorizationFixture,
    "deployment-variable.txt",
  );
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
elif [[ "$1" == "variable" && "$2" == "set" ]]; then
  printf '%s\\n' "$*" >> "$VARIABLE_CAPTURE"
  exit 0
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
    VARIABLE_CAPTURE: variableCapture,
  };
  const authorized = spawnSync("bash", [authorizedDeploy, `${runId}`], {
    cwd: root,
    encoding: "utf8",
    env: fixtureEnvironment,
  });
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.match(readFileSync(capture, "utf8"), /actions\/runs\/123456/);
  assert.match(readFileSync(capture, "utf8"), /'none'/);
  const recordedStates = readFileSync(variableCapture, "utf8");
  assert.match(recordedStates, /"status":"deploying"/);
  assert.match(recordedStates, /"status":"ready"/);

  const authorizedWithSeparator = spawnSync(
    "bash",
    [authorizedDeploy, "--", `${runId}`],
    {
      cwd: root,
      encoding: "utf8",
      env: fixtureEnvironment,
    },
  );
  assert.equal(
    authorizedWithSeparator.status,
    0,
    authorizedWithSeparator.stderr,
  );

  const malformedArguments = spawnSync(
    "bash",
    [authorizedDeploy, "--", "invalid"],
    {
      cwd: root,
      encoding: "utf8",
      env: fixtureEnvironment,
    },
  );
  assert.equal(malformedArguments.status, 64);
  assert.match(malformedArguments.stderr, /Usage:/);

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
