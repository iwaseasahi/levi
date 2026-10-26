import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(root, "scripts");
const fixture = mkdtempSync(path.join(tmpdir(), "levi-scheduled-deployment."));
const previous = "a".repeat(40);
const selected = "b".repeat(40);
const changed = "c".repeat(40);
const application = `ghcr.io/iwaseasahi/levi@sha256:${"d".repeat(64)}`;
const migration = `ghcr.io/iwaseasahi/levi-migrate@sha256:${"e".repeat(64)}`;
const ready = {
  schema_version: 1,
  status: "ready",
  commit_sha: previous,
  application_image: application,
  migration_image: migration,
  authorization_run_url: "https://github.com/iwaseasahi/levi/actions/runs/42",
  recorded_at: "2026-10-20T01:00:00Z",
};
const candidate = {
  schema_version: 1,
  repository: "iwaseasahi/levi",
  run_id: 100,
  run_attempt: 1,
  commit_sha: selected,
  application_image: application,
  migration_image: migration,
  prepared_at: "2026-10-27T01:00:00Z",
};
const authorization = {
  ...candidate,
  schema_version: 4,
  run_id: 200,
  authorization_run_url: "https://github.com/iwaseasahi/levi/actions/runs/200",
  sunday_authorization_run_url: null,
  release_candidate_run_id: 100,
  authorized_at: "2026-10-27T01:00:00Z",
};

function executable(name: string, source: string) {
  const target = path.join(fixture, name);
  writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${source}\n`);
  chmodSync(target, 0o755);
}

try {
  executable(
    "date",
    `
case "$*" in
  *%u:%H*) if [[ "$FAKE_MODE" == outside ]]; then echo 1:10; else echo 2:10; fi ;;
  *%u*) if [[ "$FAKE_MODE" == daychanged ]]; then echo 3; else echo 2; fi ;;
  *) echo 2026-10-27T01:00:00Z ;;
esac`,
  );
  executable(
    "git",
    `
printf 'git %s\\n' "$*" >> "$CALLS"
case "$1" in
  remote) if [[ "$FAKE_MODE" == fork ]]; then echo https://github.com/other/levi.git; else echo https://github.com/iwaseasahi/levi.git; fi ;;
  rev-parse) if [[ "$2" == --git-common-dir ]]; then echo "$COMMON"; else echo '${selected}'; fi ;;
  merge-base) if [[ "$FAKE_MODE" == nonforward ]]; then exit 1; fi ;;
  diff) if [[ "$FAKE_MODE" == dirty ]]; then exit 1; fi ;;
  worktree)
    last=""; penultimate=""
    for item in "$@"; do penultimate="$last"; last="$item"; done
    if [[ "$2" == add ]]; then mkdir -p "$penultimate"; cp -R "$ACTUAL_SCRIPTS" "$penultimate/scripts";
    else rm -rf "$last"; fi ;;
  fetch) ;;
  *) echo 'Unexpected synthetic git call.' >&2; exit 70 ;;
esac`,
  );
  executable(
    "ssh",
    `
printf 'ssh %s\\n' "$*" >> "$CALLS"
if [[ "$FAKE_MODE" == remoteday && "$*" == *sudo* ]]; then
  last=""; for item in "$@"; do last="$item"; done
  guard="\${last%% && sudo*}"
  FAKE_MODE=daychanged bash -c "$guard"
fi`,
  );
  executable(
    "gh",
    `
printf 'gh %s\\n' "$*" >> "$CALLS"
if [[ "$1" == api ]]; then
  case "$2" in
    */actions/variables/LEVI_PRODUCTION_DEPLOYMENT)
      count=0; [[ ! -f "$STATE_COUNT" ]] || count="$(cat "$STATE_COUNT")"
      count=$((count + 1)); echo "$count" > "$STATE_COUNT"
      if [[ "$FAKE_MODE" == changed && "$count" -ge 2 ]] || [[ "$FAKE_MODE" == changedatapply && "$count" -ge 3 ]]; then
        jq --arg commit '${changed}' '.commit_sha=$commit' "$STATE"
      elif [[ "$FAKE_MODE" == already && "$count" -ge 2 ]]; then
        jq --arg commit '${selected}' '.commit_sha=$commit' "$STATE"
      else cat "$STATE"; fi ;;
    */commits/*/check-runs*)
      if [[ "$FAKE_MODE" == missingci ]]; then echo '{"check_runs":[]}';
      else jq -n --arg conclusion "$(if [[ "$FAKE_MODE" == failedci ]]; then echo failure; else echo success; fi)" \
        '{check_runs:["Quality","Database","E2E","Security"]|map({name:.,status:"completed",conclusion:$conclusion,started_at:"1"})}'; fi ;;
    */actions/runs/200/pending_deployments) echo '[{"environment":{"name":"production-sunday"}}]' ;;
    */actions/runs/100) echo '{"event":"workflow_dispatch","status":"completed","conclusion":"success","head_branch":"main","workflow_id":10,"run_attempt":1}' ;;
    */actions/runs/200)
      if [[ "$FAKE_MODE" == approval ]]; then echo '{"status":"waiting","conclusion":null}';
      else echo '{"event":"workflow_dispatch","status":"completed","conclusion":"success","head_branch":"main","workflow_id":20,"run_attempt":1}'; fi ;;
    */actions/workflows/10) echo .github/workflows/publish-production-images.yml ;;
    */actions/workflows/20) echo .github/workflows/deploy-production.yml ;;
    *) echo 'Unexpected synthetic API call.' >&2; exit 70 ;;
  esac
elif [[ "$1" == workflow && "$2" == run ]]; then
  if [[ "$FAKE_MODE" == preparefailure ]]; then exit 70; fi
elif [[ "$1" == run && "$2" == list ]]; then
  if [[ "$*" == *publish-production-images.yml* ]]; then
    echo '[{"databaseId":100,"createdAt":"2026-10-27T01:00:00Z","displayTitle":"Prepare production candidate for ${selected}"}]'
  else echo '[{"databaseId":200,"createdAt":"2026-10-27T01:00:00Z","displayTitle":"Validate production candidate #100"}]'; fi
elif [[ "$1" == run && "$2" == download ]]; then
  source="$CANDIDATE"; filename=production-release-candidate.json
  if [[ "$*" == *production-deploy-authorization-* ]]; then source="$AUTHORIZATION"; filename=production-deploy-authorization.json; fi
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == --dir ]]; then cp "$source" "$2/$filename"; exit 0; fi
    shift
  done
  exit 70
elif [[ "$1" == run && ("$2" == watch || "$2" == cancel) ]]; then :
elif [[ "$1" == variable && "$2" == set ]]; then :
else echo 'Unexpected synthetic gh call.' >&2; exit 70
fi`,
  );

  for (const args of [
    ["--commit"],
    ["--commit", "invalid"],
    ["--output"],
    ["--unknown"],
  ]) {
    const rejected = spawnSync(
      "bash",
      [path.join(scripts, "prepare-production-release.sh"), ...args],
      { encoding: "utf8" },
    );
    assert.equal(rejected.status, 64, rejected.stderr);
  }

  let scenarios = 0;
  function run(mode: string, state: unknown = ready, args: string[] = []) {
    const directory = path.join(fixture, `case-${scenarios++}`);
    mkdirSync(directory);
    const common = path.join(directory, "common");
    mkdirSync(common);
    if (mode === "applybusy") {
      mkdirSync(
        path.join(
          directory,
          "operator-state",
          "levi",
          "production-deploy.lock",
        ),
        { recursive: true },
      );
    }
    if (mode === "busy")
      mkdirSync(path.join(common, "levi-scheduled-production-release.lock"));
    const stateFile = path.join(directory, "state.json");
    const candidateFile = path.join(directory, "candidate.json");
    const authorizationFile = path.join(directory, "authorization.json");
    const calls = path.join(directory, "calls");
    writeFileSync(
      stateFile,
      typeof state === "string" ? state : JSON.stringify(state),
    );
    writeFileSync(candidateFile, JSON.stringify(candidate));
    writeFileSync(
      authorizationFile,
      JSON.stringify(
        mode === "wrongauthorization"
          ? { ...authorization, commit_sha: changed }
          : authorization,
      ),
    );
    writeFileSync(calls, "");
    const result = spawnSync(
      "bash",
      [path.join(scripts, "run-scheduled-production-release.sh"), ...args],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: `${fixture}:${process.env.PATH ?? ""}`,
          FAKE_MODE: mode,
          ACTUAL_SCRIPTS: scripts,
          COMMON: common,
          XDG_STATE_HOME: path.join(directory, "operator-state"),
          STATE: stateFile,
          STATE_COUNT: path.join(directory, "count"),
          CANDIDATE: candidateFile,
          AUTHORIZATION: authorizationFile,
          CALLS: calls,
          LEVI_ALLOW_TEST_OVERRIDES: "true",
          LEVI_CI_WAIT_MAX_ATTEMPTS: "1",
          LEVI_CI_WAIT_INTERVAL_SECONDS: "0",
          LEVI_AUTHORIZATION_WAIT_INTERVAL_SECONDS: "0",
          LEVI_UNATTENDED_DEPLOYMENT: "false",
        },
      },
    );
    assert.equal(result.error, undefined, result.error?.message);
    return { ...result, calls: readFileSync(calls, "utf8") };
  }

  const same = run("same", { ...ready, commit_sha: selected });
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /already successfully deployed/);
  assert.doesNotMatch(same.calls, /gh workflow|ssh /);

  const dry = run("new", ready, ["--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run: would release/);
  assert.doesNotMatch(dry.calls, /gh workflow|ssh /);

  const outside = run("outside");
  assert.equal(outside.status, 0, outside.stderr);
  assert.match(outside.stdout, /scheduled start window/);
  assert.equal(outside.calls, "");

  for (const mode of [
    "busy",
    "nonforward",
    "fork",
    "dirty",
    "failedci",
    "missingci",
  ]) {
    const denied = run(mode);
    assert.notEqual(denied.status, 0, `${mode}: ${denied.stdout}`);
    assert.doesNotMatch(denied.calls, /gh workflow|ssh /, mode);
  }
  for (const state of [
    "synthetic-do-not-log",
    {},
    { ...ready, status: "deploying" },
    { ...ready, application_image: "mutable:latest" },
    { ...ready, recorded_at: "invalid" },
  ]) {
    const denied = run("invalid", state);
    assert.equal(denied.status, 65, denied.stderr);
    assert.match(denied.stderr, /state must be valid and ready/);
    assert.doesNotMatch(denied.stderr, /synthetic-do-not-log/);
    assert.doesNotMatch(denied.calls, /gh workflow|ssh /);
  }

  for (const mode of [
    "preparefailure",
    "applybusy",
    "changed",
    "changedatapply",
    "wrongauthorization",
    "approval",
    "daychanged",
  ]) {
    const denied = run(mode);
    assert.notEqual(denied.status, 0, `${mode}: ${denied.stdout}`);
    assert.doesNotMatch(denied.calls, /sudo -n|gh variable set/, mode);
    if (mode === "approval") {
      assert.match(denied.stderr, /cannot wait for Environment approval/);
      assert.match(denied.calls, /gh run cancel 200/);
    }
  }

  const already = run("already");
  assert.equal(already.status, 0, already.stderr);
  assert.match(
    already.stdout,
    /successfully deployed while images were prepared/,
  );
  assert.doesNotMatch(already.calls, /sudo -n|gh variable set/);

  const remoteDay = run("remoteday");
  assert.notEqual(remoteDay.status, 0, remoteDay.stdout);
  assert.match(remoteDay.calls, /"status":"deploying"/);
  assert.doesNotMatch(remoteDay.calls, /"status":"ready"/);

  const released = run("new");
  assert.equal(released.status, 0, released.stderr);
  assert.match(released.calls, new RegExp(`--field commit_sha=${selected}`));
  assert.match(released.calls, /--field release_candidate_run_id=100/);
  assert.match(released.calls, /sudo -n.*levi-production-deploy/);
  assert.match(released.calls, /"status":"deploying"/);
  assert.match(released.calls, /"status":"ready"/);
  assert.match(released.stdout, /Scheduled production release completed/);
  console.log(
    `Scheduled deployment safeguards passed ${scenarios} synthetic scenarios; no real GitHub or production calls.`,
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
