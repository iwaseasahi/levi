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
const fixture = mkdtempSync(path.join(tmpdir(), "levi-ci-pagination."));
const commit = "a".repeat(40);
const required = ["Quality", "Database", "E2E", "Security"];
const checks = (
  status = "completed",
  conclusion: string | null = "success",
  time = "2",
) => required.map((name) => ({ name, status, conclusion, started_at: time }));
const noise = Array.from({ length: 100 }, () => ({
  name: "Synthetic readiness",
  status: "completed",
  conclusion: "success",
  started_at: "3",
}));
type Check = ReturnType<typeof checks>[number];
const page = (check_runs: Check[]) => ({ check_runs });

try {
  // Simulate gh's JSON stream and per-page --jq behavior. No network or tokens.
  // API failure deliberately follows a complete first page, exercising pipefail.
  const gh = path.join(fixture, "gh");
  writeFileSync(
    gh,
    `#!/usr/bin/env python3
import json, os, subprocess, sys
args = sys.argv[1:]
assert args[0] == 'api' and any('/commits/' + '${commit}' + '/check-runs?' in arg for arg in args)
pages = json.loads(os.environ['SYNTHETIC_CI_PAGES'])
if '--paginate' not in args:
    pages = pages[:1]
query = args[args.index('--jq') + 1] if '--jq' in args else None
for index, item in enumerate(pages):
    if index == 1 and os.environ.get('SYNTHETIC_PAGE_FAILURE') == 'true':
        sys.exit(70)
    payload = json.dumps(item)
    if query:
        result = subprocess.run(['jq', '-r', query], input=payload, text=True, capture_output=True)
        sys.stdout.write(result.stdout)
        if result.returncode:
            sys.exit(result.returncode)
    else:
        print(payload, flush=True)
`,
  );
  chmodSync(gh, 0o755);

  const gates = [
    {
      name: "host wait",
      args: [path.join(root, "scripts/wait-for-required-ci.sh"), commit],
    },
  ];
  for (const name of ["publish-production-images", "deploy-production"]) {
    const workflow = readFileSync(
      path.join(root, `.github/workflows/${name}.yml`),
      "utf8",
    );
    // Execute the actual embedded CI gate, including aggregation when present.
    const body = workflow.match(
      /(?:          checks_json=.*\n)?          for required in Quality Database E2E Security; do\n[\s\S]*?\n          done/,
    );
    assert.ok(body, `Missing executable CI gate in ${name}`);
    const target = path.join(fixture, `${name}.sh`);
    writeFileSync(
      target,
      `set -euo pipefail\n${body[0].replace(/^          /gm, "")}\n`,
    );
    gates.push({ name, args: [target] });
  }

  const scenarios = [
    { name: "single page", pages: [page(checks())], pass: true },
    {
      name: "required checks on second page",
      pages: [page(noise), page(checks())],
      pass: true,
    },
    {
      name: "required checks spread over three pages",
      pages: [
        page([...noise.slice(0, 99), checks()[0]!]),
        page(checks().slice(1, 3)),
        page(checks().slice(3)),
      ],
      pass: true,
    },
    {
      name: "newer failure on first page",
      pages: [page(checks("completed", "failure", "3")), page(checks())],
      pass: false,
    },
    {
      name: "newer failure on later page",
      pages: [page(checks()), page(checks("completed", "failure", "3"))],
      pass: false,
    },
    {
      name: "newer success after older failure",
      pages: [page(checks("completed", "failure", "1")), page(checks())],
      pass: true,
    },
    {
      name: "newer pending on later page",
      pages: [page(checks()), page(checks("in_progress", null, "3"))],
      pass: false,
    },
    {
      name: "missing required check",
      pages: [page(noise), page(checks().slice(1))],
      pass: false,
    },
    {
      name: "second page API failure after successes",
      pages: [page(checks()), page(noise)],
      pass: false,
      apiFailure: true,
    },
  ];
  const failures: string[] = [];
  for (const gate of gates) {
    for (const scenario of scenarios) {
      const result = spawnSync("bash", gate.args, {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          NODE_ENV: "test",
          PATH: `${fixture}:${process.env.PATH ?? ""}`,
          GITHUB_REPOSITORY: "synthetic/release",
          COMMIT_SHA: commit,
          commit_sha: commit,
          SYNTHETIC_CI_PAGES: JSON.stringify(scenario.pages),
          SYNTHETIC_PAGE_FAILURE: String(scenario.apiFailure ?? false),
          LEVI_ALLOW_TEST_OVERRIDES: "true",
          LEVI_CI_WAIT_MAX_ATTEMPTS: "1",
          LEVI_CI_WAIT_INTERVAL_SECONDS: "0",
        },
      });
      assert.equal(result.error, undefined, result.error?.message);
      if ((result.status === 0) !== scenario.pass) {
        failures.push(
          `${gate.name}: ${scenario.name}: status=${result.status} ${result.stderr.trim()}`,
        );
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log(
    `Required CI pagination: ${gates.length * scenarios.length} subprocess scenarios passed.`,
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
