import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monitor = path.join(root, "scripts", "run-production-health-monitor.sh");
const lifecycleRecorder = path.join(
  root,
  "scripts",
  "record-production-container-lifecycle.sh",
);
const lifecycleSummary = path.join(
  root,
  "scripts",
  "summarize-production-container-lifecycle.sh",
);
const healthCheck = readFileSync(
  path.join(root, "scripts", "check-production-health.sh"),
  "utf8",
);
const workflow = readFileSync(
  path.join(root, ".github", "workflows", "production-smoke.yml"),
  "utf8",
);
const service = readFileSync(
  path.join(root, "deploy", "production", "systemd", "levi-health.service"),
  "utf8",
);
const timer = readFileSync(
  path.join(root, "deploy", "production", "systemd", "levi-health.timer"),
  "utf8",
);
const monitoringExample = readFileSync(
  path.join(root, "deploy", "production", "monitoring.env.example"),
  "utf8",
);

const syntax = spawnSync(
  "bash",
  ["-n", monitor, lifecycleRecorder, lifecycleSummary],
  { encoding: "utf8" },
);
assert.equal(syntax.status, 0, syntax.stderr);

assert.match(workflow, /cron: "0 \* \* \* \*"/);
assert.doesNotMatch(workflow, /cron: "\*\/15/);
assert.match(workflow, /secrets\.SLACK_MONITORING_WEBHOOK_URL/);
assert.match(workflow, /if: \$\{\{ failure\(\) \}\}/);
assert.match(workflow, /https:\/\/hooks\\\.slack\\\.com\/services\//);
assert.doesNotMatch(workflow, /echo .*SLACK_MONITORING_WEBHOOK_URL/);

assert.match(
  service,
  /ExecStart=\/opt\/levi\/scripts\/run-production-health-monitor\.sh/,
);
assert.match(service, /container lifecycle/);
assert.match(service, /StateDirectory=levi-monitoring/);
assert.match(service, /StateDirectoryMode=0700/);
assert.match(timer, /OnUnitActiveSec=1m/);
assert.match(monitoringExample, /^LEVI_SLACK_WEBHOOK_URL=$/m);
assert.match(monitoringExample, /^LEVI_SLIDE_IMAGE_CAPACITY_PERCENT=80$/m);
assert.match(healthCheck, /SLIDE_IMAGE_BYTES_PER_CHURCH/);
assert.match(healthCheck, /FROM slide_images/);
assert.match(healthCheck, /slide_image_percent=/);
assert.match(healthCheck, /slide_image_table_bytes=/);
assert.match(healthCheck, /database_bytes=/);
assert.match(healthCheck, /weekly_backup_bytes=/);

const fixture = mkdtempSync(path.join(tmpdir(), "levi-monitoring."));
try {
  const fakeBin = path.join(fixture, "bin");
  const stateRoot = path.join(fixture, "state");
  const modeFile = path.join(fixture, "health-mode");
  const lifecycleModeFile = path.join(fixture, "lifecycle-mode");
  const notificationCount = path.join(fixture, "notifications");
  const notificationPayloads = path.join(fixture, "payloads");
  const healthCheck = path.join(fixture, "health-check");
  const lifecycleCheck = path.join(fixture, "lifecycle-check");
  spawnSync("mkdir", ["-p", fakeBin]);
  writeFileSync(modeFile, "failure\n");
  writeFileSync(lifecycleModeFile, "success\n");
  writeFileSync(
    healthCheck,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$(cat "$HEALTH_MODE_FILE")" == "success" ]]; then
  echo "synthetic health passed"
  exit 0
fi
echo "synthetic health failed" >&2
exit 1
`,
  );
  writeFileSync(
    lifecycleCheck,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$(cat "$LIFECYCLE_MODE_FILE")" == "success" ]]; then
  echo "synthetic lifecycle passed"
  exit 0
fi
echo "synthetic lifecycle failed" >&2
exit 1
`,
  );
  writeFileSync(
    path.join(fakeBin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
payload=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--data" ]]; then
    payload="$2"
    shift 2
    continue
  fi
  shift
done
printf '.\n' >> "$NOTIFICATION_COUNT_FILE"
printf '%s\n' "$payload" >> "$NOTIFICATION_PAYLOAD_FILE"
`,
  );
  chmodSync(healthCheck, 0o755);
  chmodSync(lifecycleCheck, 0o755);
  chmodSync(path.join(fakeBin, "curl"), 0o755);

  const environment = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    HEALTH_MODE_FILE: modeFile,
    LIFECYCLE_MODE_FILE: lifecycleModeFile,
    NOTIFICATION_COUNT_FILE: notificationCount,
    NOTIFICATION_PAYLOAD_FILE: notificationPayloads,
    LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
    LEVI_ALLOW_TEST_OVERRIDES: "true",
    LEVI_HEALTH_CHECK_SCRIPT: healthCheck,
    LEVI_CONTAINER_LIFECYCLE_SCRIPT: lifecycleCheck,
    LEVI_MONITORING_STATE_ROOT: stateRoot,
    LEVI_SLACK_WEBHOOK_URL:
      "https://hooks.slack.com/services/T00000000/B00000000/synthetic-token",
  };

  const firstFailure = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(firstFailure.status, 1);
  assert.match(firstFailure.stderr, /incident notification completed/);
  assert.equal(
    readFileSync(notificationCount, "utf8").trim().split("\n").length,
    1,
  );
  assert.equal(existsSync(path.join(stateRoot, "health-failed")), true);

  const repeatedFailure = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(repeatedFailure.status, 1);
  assert.doesNotMatch(repeatedFailure.stderr, /notification completed/);
  assert.equal(
    readFileSync(notificationCount, "utf8").trim().split("\n").length,
    1,
  );

  writeFileSync(modeFile, "success\n");
  const recovery = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.match(recovery.stdout, /recovery notification completed/);
  assert.equal(
    readFileSync(notificationCount, "utf8").trim().split("\n").length,
    2,
  );
  assert.equal(existsSync(path.join(stateRoot, "health-failed")), false);

  writeFileSync(lifecycleModeFile, "failure\n");
  const lifecycleFailure = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(lifecycleFailure.status, 1);
  assert.match(lifecycleFailure.stderr, /synthetic lifecycle failed/);
  assert.equal(
    readFileSync(notificationCount, "utf8").trim().split("\n").length,
    3,
  );
  assert.equal(existsSync(path.join(stateRoot, "health-failed")), true);

  writeFileSync(lifecycleModeFile, "success\n");
  const lifecycleRecovery = spawnSync("bash", [monitor], {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(lifecycleRecovery.status, 0, lifecycleRecovery.stderr);
  assert.match(lifecycleRecovery.stdout, /recovery notification completed/);
  assert.equal(
    readFileSync(notificationCount, "utf8").trim().split("\n").length,
    4,
  );

  const payloads = readFileSync(notificationPayloads, "utf8");
  assert.match(payloads, /内部監視で異常を検知/);
  assert.match(payloads, /内部監視が復旧/);
  assert.doesNotMatch(payloads, /synthetic-token/);
  assert.doesNotMatch(
    `${firstFailure.stdout}${firstFailure.stderr}${recovery.stdout}${recovery.stderr}`,
    /synthetic-token/,
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const lifecycleFixture = mkdtempSync(path.join(tmpdir(), "levi-lifecycle."));
try {
  const fakeBin = path.join(lifecycleFixture, "bin");
  const stateRoot = path.join(lifecycleFixture, "state");
  const dockerState = path.join(lifecycleFixture, "docker-state.json");
  const journal = path.join(lifecycleFixture, "journal");
  const composeFile = path.join(lifecycleFixture, "compose.yaml");
  const environmentFile = path.join(lifecycleFixture, "production.env");
  spawnSync("mkdir", ["-p", fakeBin]);
  writeFileSync(composeFile, "services: {}\n");
  writeFileSync(environmentFile, "SYNTHETIC=true\n");
  writeFileSync(
    path.join(fakeBin, "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "compose" ]]; then
  service="\${!#}"
  printf 'container-%s\\n' "$service"
  exit 0
fi
if [[ "\${1:-}" == "inspect" ]]; then
  container="\${!#}"
  service="\${container#container-}"
  jq -r --arg service "$service" \
    '.[$service] | "\\(.created_at)|\\(.started_at)|\\(.restart_count)"' \
    "$LIFECYCLE_FIXTURE_FILE"
  exit 0
fi
exit 2
`,
  );
  chmodSync(path.join(fakeBin, "docker"), 0o755);

  const writeDockerState = (app: {
    created_at: string;
    started_at: string;
    restart_count: number;
  }) => {
    writeFileSync(
      dockerState,
      `${JSON.stringify(
        {
          proxy: {
            created_at: "2026-09-01T00:00:00.000000000Z",
            started_at: "2026-09-01T00:00:01.000000000Z",
            restart_count: 0,
          },
          app,
          postgres: {
            created_at: "2026-09-01T00:00:00.000000000Z",
            started_at: "2026-09-01T00:00:02.000000000Z",
            restart_count: 0,
          },
        },
        null,
        2,
      )}\n`,
    );
  };
  const initialApp = {
    created_at: "2026-09-01T00:00:00.000000000Z",
    started_at: "2026-09-01T00:00:03.000000000Z",
    restart_count: 0,
  };
  writeDockerState(initialApp);

  const lifecycleEnvironment = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    LIFECYCLE_FIXTURE_FILE: dockerState,
    LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
    LEVI_ALLOW_TEST_OVERRIDES: "true",
    LEVI_COMPOSE_FILE: composeFile,
    LEVI_ENV_FILE: environmentFile,
    LEVI_MONITORING_STATE_ROOT: stateRoot,
  };
  const recordAt = (epoch: number) => {
    const result = spawnSync("bash", [lifecycleRecorder], {
      encoding: "utf8",
      env: {
        ...lifecycleEnvironment,
        LEVI_LIFECYCLE_OBSERVED_AT_EPOCH: String(epoch),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };

  const initial = recordAt(1000);
  const steady = recordAt(1060);
  writeDockerState({
    ...initialApp,
    started_at: "2026-09-01T01:00:03.000000000Z",
    restart_count: 1,
  });
  const restarted = recordAt(1120);
  writeDockerState({
    created_at: "2026-09-01T02:00:00.000000000Z",
    started_at: "2026-09-01T02:00:03.000000000Z",
    restart_count: 0,
  });
  const replaced = recordAt(1180);
  const finalSteady = recordAt(1240);
  const lifecycleOutput = `${initial}${steady}${restarted}${replaced}${finalSteady}`;
  writeFileSync(journal, lifecycleOutput);

  assert.match(initial, /service=app generation=1 .*event=initialized/);
  assert.match(steady, /service=app generation=1 .*event=steady/);
  assert.match(restarted, /service=app generation=1 .*event=restart/);
  assert.match(replaced, /service=app generation=2 .*event=replacement/);
  assert.doesNotMatch(
    lifecycleOutput,
    /container-app|image|environment|secret/i,
  );
  for (const serviceName of ["proxy", "app", "postgres"]) {
    const state = readFileSync(
      path.join(stateRoot, `container-${serviceName}.json`),
      "utf8",
    );
    assert.doesNotMatch(state, /container-|image|environment|secret/i);
    assert.equal(
      statSync(path.join(stateRoot, `container-${serviceName}.json`)).mode &
        0o777,
      0o600,
    );
  }
  assert.equal(statSync(stateRoot).mode & 0o777, 0o700);

  const summaryEnvironment = {
    ...process.env,
    LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
    LEVI_ALLOW_TEST_OVERRIDES: "true",
    LEVI_LIFECYCLE_JOURNAL_FILE: journal,
  };
  const completeSummary = spawnSync(
    "bash",
    [lifecycleSummary, "1000", "1240"],
    { encoding: "utf8", env: summaryEnvironment },
  );
  assert.equal(completeSummary.status, 0, completeSummary.stderr);
  assert.match(
    completeSummary.stdout,
    /service=app coverage=complete reason=none samples=5 replacements=1 restarts=1 generation_start=1 generation_end=2 restart_count_start=0 restart_count_end=0/,
  );

  const insufficientSummary = spawnSync(
    "bash",
    [lifecycleSummary, "940", "1240"],
    { encoding: "utf8", env: summaryEnvironment },
  );
  assert.equal(insufficientSummary.status, 1);
  assert.match(
    insufficientSummary.stdout,
    /coverage=insufficient reason=coverage_started_after_period/,
  );

  const gapJournal = path.join(lifecycleFixture, "gap-journal");
  writeFileSync(
    gapJournal,
    lifecycleOutput
      .split("\n")
      .filter(
        (line) =>
          line.includes("service=proxy") &&
          (line.includes("observed_at_epoch=1000") ||
            line.includes("observed_at_epoch=1240")),
      )
      .join("\n") + "\n",
  );
  const gapSummary = spawnSync("bash", [lifecycleSummary, "1000", "1240"], {
    encoding: "utf8",
    env: {
      ...summaryEnvironment,
      LEVI_LIFECYCLE_JOURNAL_FILE: gapJournal,
    },
  });
  assert.equal(gapSummary.status, 1);
  assert.match(
    gapSummary.stdout,
    /service=proxy coverage=insufficient reason=sample_gap/,
  );

  const malformedJournal = path.join(lifecycleFixture, "malformed-journal");
  writeFileSync(
    malformedJournal,
    "Production container lifecycle: service=app generation=1 started_at=private-value restart_count=0 event=steady coverage_started_at_epoch=1000 observed_at_epoch=1000\n",
  );
  const malformedSummary = spawnSync(
    "bash",
    [lifecycleSummary, "1000", "1240"],
    {
      encoding: "utf8",
      env: {
        ...summaryEnvironment,
        LEVI_LIFECYCLE_JOURNAL_FILE: malformedJournal,
      },
    },
  );
  assert.equal(malformedSummary.status, 2);
  assert.match(malformedSummary.stderr, /invalid record/);
  assert.doesNotMatch(
    `${malformedSummary.stdout}${malformedSummary.stderr}`,
    /private-value/,
  );

  const appStatePath = path.join(stateRoot, "container-app.json");
  const corruptAppState = JSON.parse(
    readFileSync(appStatePath, "utf8"),
  ) as Record<string, unknown>;
  corruptAppState.created_at = "private-value";
  writeFileSync(appStatePath, `${JSON.stringify(corruptAppState)}\n`, {
    mode: 0o600,
  });
  const corruptStateResult = spawnSync("bash", [lifecycleRecorder], {
    encoding: "utf8",
    env: {
      ...lifecycleEnvironment,
      LEVI_LIFECYCLE_OBSERVED_AT_EPOCH: "1300",
    },
  });
  assert.equal(corruptStateResult.status, 1);
  assert.match(
    corruptStateResult.stderr,
    /Stored production app lifecycle state is invalid/,
  );
  assert.doesNotMatch(
    `${corruptStateResult.stdout}${corruptStateResult.stderr}`,
    /private-value/,
  );
} finally {
  rmSync(lifecycleFixture, { recursive: true, force: true });
}

console.log(
  "Monitoring configuration, lifecycle evidence, and Slack transition routing passed.",
);
