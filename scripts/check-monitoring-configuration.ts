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
const monitor = path.join(root, "scripts", "run-production-health-monitor.sh");
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

const syntax = spawnSync("bash", ["-n", monitor], { encoding: "utf8" });
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
  const notificationCount = path.join(fixture, "notifications");
  const notificationPayloads = path.join(fixture, "payloads");
  const healthCheck = path.join(fixture, "health-check");
  spawnSync("mkdir", ["-p", fakeBin]);
  writeFileSync(modeFile, "failure\n");
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
  chmodSync(path.join(fakeBin, "curl"), 0o755);

  const environment = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    HEALTH_MODE_FILE: modeFile,
    NOTIFICATION_COUNT_FILE: notificationCount,
    NOTIFICATION_PAYLOAD_FILE: notificationPayloads,
    LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
    LEVI_ALLOW_TEST_OVERRIDES: "true",
    LEVI_HEALTH_CHECK_SCRIPT: healthCheck,
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

console.log("Monitoring configuration and Slack transition routing passed.");
