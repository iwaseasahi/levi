import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const fixture = mkdtempSync(path.join(tmpdir(), "levi-host-release."));
const previous = "a".repeat(40),
  selected = "b".repeat(40);
const app = `ghcr.io/iwaseasahi/levi@sha256:${"c".repeat(64)}`;
const migration = `ghcr.io/iwaseasahi/levi-migrate@sha256:${"d".repeat(64)}`;
const url = "https://github.com/iwaseasahi/levi/actions/runs/200";
function executable(target: string, text: string) {
  writeFileSync(target, `#!/bin/bash\nset -euo pipefail\n${text}\n`);
  chmodSync(target, 0o755);
}
try {
  const bundle = path.join(fixture, "bundle");
  mkdirSync(path.join(bundle, "bin"), { recursive: true });
  cpSync(path.join(root, "scripts"), path.join(bundle, "scripts"), {
    recursive: true,
  });
  // Only a disposable copy changes UID/path constants; production has no test override.
  const source = readFileSync(
    path.join(root, "scripts/production-deploy-entrypoint.sh"),
    "utf8",
  );
  assert.doesNotMatch(source, /LEVI_ALLOW_TEST|LEVI_ALLOW_NON_ROOT/);
  const host = path.join(fixture, "entrypoint");
  writeFileSync(
    host,
    source
      .replace('if [[ "$EUID" -ne 0 ]]; then', "if false; then")
      .replaceAll("/usr/local/lib/levi-release", bundle)
      .replace(
        'readonly repository_path="/opt/levi"',
        'readonly repository_path="$FIXTURE_REPOSITORY"',
      )
      .replace(
        'readonly deployment_root="/var/lib/levi-deploy"',
        'readonly deployment_root="$FIXTURE_STATE"',
      )
      .replace(
        'readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"',
        `readonly safe_path="${fixture}:$PATH"`,
      )
      .replaceAll("/usr/bin/env", `${fixture}/env`)
      .replaceAll("/usr/bin/git", `${fixture}/git`),
  );
  executable(
    path.join(fixture, "env"),
    `
[[ "$1" != -i ]] || shift
while [[ "$1" == *=* ]]; do export "$1"; shift; done
exec "$@"`,
  );
  executable(
    path.join(fixture, "date"),
    `
if [[ "$*" == *%u* ]]; then
  count=0; [[ ! -f "$FIXTURE_STATE/days" ]] || count="$(cat "$FIXTURE_STATE/days")"
  echo $((count + 1)) > "$FIXTURE_STATE/days"
  if [[ "$MODE" == sunday || "$MODE" == sundaymissing ]]; then echo 7;
  elif [[ "$MODE" == wednesday || ("$MODE" == daychanged && "$count" -ge 1) ]]; then echo 3; else echo 2; fi
else echo 2026-10-27T01:00:00Z; fi`,
  );
  executable(
    path.join(fixture, "git"),
    `
[[ -d "$FIXTURE_STATE/.transaction.lock" ]]
printf 'git %s\\n' "$*" >> "$CALLS"
if [[ "$MODE" == nonforward && "$*" == *'${previous} ${selected}'* ]]; then exit 1; fi`,
  );
  const fakeGh = `
printf 'gh %s\\n' "$*" >> "$CALLS"
[[ -d "$FIXTURE_STATE/.transaction.lock" ]] || { echo 'Missing transaction lock' >&2; exit 70; }
if [[ "$1" == api ]]; then
 case "$2" in
  */actions/runs/200) echo '{"event":"workflow_dispatch","status":"completed","conclusion":"success","head_branch":"main","workflow_id":20,"run_attempt":1}' ;;
  */actions/workflows/20) echo .github/workflows/deploy-production.yml ;;
  */actions/variables/LEVI_PRODUCTION_DEPLOYMENT) cat "$FIXTURE_STATE/ready.json" ;;
  */check-runs*) jq -n --arg conclusion "$(if [[ "$MODE" == failedci ]]; then echo failure; else echo success; fi)" '{check_runs:["Quality","Database","E2E","Security"]|map({name:.,status:"completed",conclusion:$conclusion,started_at:"1"})}' ;;
  *) exit 70 ;;
 esac
elif [[ "$1" == run && "$2" == download ]]; then
 while [[ $# -gt 0 ]]; do
  if [[ "$1" == --dir ]]; then cp "$FIXTURE_STATE/authorization.json" "$2/production-deploy-authorization.json"; exit 0; fi
  shift
 done
 exit 70
elif [[ "$1" == variable && "$2" == set ]]; then
 [[ -d "$FIXTURE_STATE/.transaction.lock" ]]
else exit 70; fi`;
  executable(path.join(bundle, "bin/gh"), fakeGh);
  executable(path.join(fixture, "gh"), fakeGh);
  let scenarios = 0;
  function run(mode: string, manual = false) {
    const state = path.join(fixture, `case-${scenarios++}`),
      repo = path.join(state, "repo");
    mkdirSync(path.join(repo, "scripts"), { recursive: true });
    executable(
      path.join(repo, "scripts/production-deploy.sh"),
      `
[[ -d "$FIXTURE_STATE/.transaction.lock" ]]
[[ "$LEVI_DEPLOY_COMMIT" == '${selected}' && "$LEVI_IMAGE" == '${app}' ]]
if [[ "$MODE" == sunday ]]; then [[ "$LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE" == '${url}' ]]; fi
echo applied >> "$CALLS"
[[ "$MODE" != applyfailure ]]`,
    );
    const ready = {
      schema_version: 1,
      status: mode === "notready" ? "deploying" : "ready",
      commit_sha: mode === "changed" ? "e".repeat(40) : previous,
      application_image: app,
      migration_image: migration,
      authorization_run_url: url,
      recorded_at: "2026-10-20T01:00:00Z",
    };
    writeFileSync(
      path.join(state, "ready.json"),
      JSON.stringify(
        mode === "metadatachanged"
          ? { ...ready, recorded_at: "2026-10-21T01:00:00Z" }
          : ready,
      ),
    );
    writeFileSync(
      path.join(state, "authorization.json"),
      JSON.stringify({
        schema_version: 4,
        repository: "iwaseasahi/levi",
        run_id: 200,
        run_attempt: 1,
        commit_sha: mode === "wrongartifact" ? previous : selected,
        application_image: app,
        migration_image: migration,
        authorization_run_url: url,
        sunday_authorization_run_url:
          mode === "sundayartifact" || mode === "sunday" ? url : null,
        release_candidate_run_id: 100,
        authorized_at: "2026-10-27T01:00:00Z",
      }),
    );
    if (mode !== "nohistory")
      writeFileSync(
        path.join(state, "current.env"),
        `commit=${mode === "hostchanged" ? selected : previous}\napplication_image=${mode === "imagechanged" ? "mutable:tag" : app}\nmigration_image=${migration}\n`,
      );
    if (mode === "busy") mkdirSync(path.join(state, ".transaction.lock"));
    const calls = path.join(state, "calls");
    writeFileSync(calls, "");
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(ready).sort(([a], [b]) => (a < b ? -1 : 1)),
          ),
        ),
      )
      .digest("hex");
    const args = [
      selected,
      app,
      migration,
      url,
      mode === "sunday" ? url : "none",
      ...(manual ? [] : [previous, fingerprint]),
    ];
    const result = spawnSync("bash", [host, ...args], {
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        SUDO_USER: mode === "untrusted" ? "other" : "levi-system-operator",
        FIXTURE_STATE: state,
        FIXTURE_REPOSITORY: repo,
        MODE: mode,
        CALLS: calls,
      },
    });
    assert.equal(result.error, undefined, result.error?.message);
    const log = readFileSync(calls, "utf8");
    if (mode !== "busy")
      assert.equal(
        existsSync(path.join(state, ".transaction.lock")),
        false,
        `${mode} leaked lock`,
      );
    else
      assert.equal(
        existsSync(path.join(state, ".transaction.lock")),
        true,
        "Must not remove another transaction's lock",
      );
    return { ...result, log };
  }
  for (const mode of [
    "busy",
    "untrusted",
    "wednesday",
    "changed",
    "metadatachanged",
    "hostchanged",
    "imagechanged",
    "nohistory",
    "notready",
    "wrongartifact",
    "sundayartifact",
    "failedci",
    "nonforward",
    "daychanged",
  ]) {
    const denied = run(mode);
    assert.notEqual(denied.status, 0, `${mode}: ${denied.stdout}`);
    const reasons: Record<string, RegExp> = {
      busy: /Another host deployment transaction/,
      untrusted: /restricted to the approved operator/,
      wednesday: /requires Tuesday/,
      changed: /baseline changed/,
      metadatachanged: /ready deployment record changed/,
      hostchanged: /Host history/,
      imagechanged: /Host history/,
      nohistory: /current.env/,
      notready: /state must be valid and ready/,
      wrongartifact: /Host authorization does not match/,
      sundayartifact: /Host authorization does not match/,
      failedci: /Latest Quality check failed/,
      nonforward: /move production forward/,
      daychanged: /cannot start outside Tuesday/,
    };
    const reason = reasons[mode];
    assert(reason, `Missing rejection reason for ${mode}`);
    assert.match(denied.stderr, reason, mode);
    assert.doesNotMatch(
      denied.log,
      /git .*switch|gh variable set|applied/,
      mode,
    );
  }
  const failed = run("applyfailure");
  assert.notEqual(failed.status, 0);
  assert.match(failed.log, /"status":"deploying"/, failed.stderr);
  assert.doesNotMatch(failed.log, /"status":"ready"/);
  for (const manual of [false, true]) {
    const success = run("success", manual);
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.log, /"status":"deploying"/);
    assert.match(success.log, /applied/);
    assert.match(success.log, /"status":"ready"/);
    assert(
      success.log.indexOf("switch --detach") <
        success.log.indexOf('"status":"deploying"'),
    );
    assert(
      success.log.indexOf("applied") < success.log.indexOf('"status":"ready"'),
    );
  }
  const sunday = run("sunday", true);
  assert.equal(sunday.status, 0, sunday.stderr);
  assert.match(sunday.log, /applied/);
  const unapprovedSunday = run("sundaymissing", true);
  assert.equal(unapprovedSunday.status, 75, unapprovedSunday.stderr);
  assert.match(
    unapprovedSunday.stderr,
    /Sunday requires exact Sunday authorization/,
  );
  assert.doesNotMatch(unapprovedSunday.log, /switch|gh variable set|applied/);
  const timer = readFileSync(
    path.join(root, "deploy/production/systemd/levi-release.timer"),
    "utf8",
  );
  assert.match(timer, /OnCalendar=Tue \*-\*-\* 10:00:00 Asia\/Tokyo/);
  assert.match(timer, /Persistent=false/);
  const installer = readFileSync(
    path.join(root, "scripts/install-production-scheduled-release.sh"),
    "utf8",
  );
  assert.doesNotMatch(installer, /systemctl (?:enable|start)/);
  assert.match(installer, /merge-base --is-ancestor/);
  assert.match(installer, /wait-for-required-ci/);
  const auth = spawnSync(
    "python3",
    ["scripts/check-production-release-auth.py"],
    { cwd: root, encoding: "utf8", timeout: 30000 },
  );
  assert.equal(auth.status, 0, auth.stderr);
  console.log(auth.stderr.trim());
  console.log(
    `Host transaction safeguards passed ${scenarios} synthetic scenarios; no production calls.`,
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
