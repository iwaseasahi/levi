import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/dependabot-auto-merge.yml", import.meta.url),
  "utf8",
);
const runBlock = workflow.split("        run: |\n")[1];
if (!runBlock) throw new Error("Missing auto-merge shell step");
const shell = runBlock.replace(/^          /gm, "");

function event() {
  return {
    number: 42,
    pull_request: {
      user: { login: "dependabot[bot]", type: "Bot" },
      head: {
        repo: { full_name: "example/levi" },
        sha: "a".repeat(40),
      },
      base: { repo: { full_name: "example/levi" }, ref: "main" },
      state: "open",
      draft: false,
    },
  };
}

function run(payload: unknown, ghExitCode = 0) {
  const directory = mkdtempSync(path.join(tmpdir(), "levi-dependabot-"));
  try {
    const eventPath = path.join(directory, "event.json");
    const callsPath = path.join(directory, "calls.json");
    writeFileSync(eventPath, JSON.stringify(payload));
    writeFileSync(
      path.join(directory, "gh"),
      '#!/bin/bash\nprintf "%s\\n" "$@" | jq --raw-input --slurp \'split("\\n")[:-1]\' > "$CALLS_PATH"\nexit "$GH_EXIT_CODE"\n',
      { mode: 0o755 },
    );
    const result = spawnSync("bash", ["-c", shell], {
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_REPOSITORY: "example/levi",
        GITHUB_EVENT_PATH: eventPath,
        GH_TOKEN: "synthetic-test-token",
        CALLS_PATH: callsPath,
        GH_EXIT_CODE: String(ghExitCode),
      },
    });
    return {
      status: result.status,
      stderr: result.stderr,
      calls: existsSync(callsPath)
        ? (JSON.parse(readFileSync(callsPath, "utf8")) as string[])
        : [],
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Dependabot auto-merge workflow", () => {
  it("requests squash auto-merge for the exact eligible head using branch protection", () => {
    const result = run(event());
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      "pr",
      "merge",
      "42",
      "--repo",
      "example/levi",
      "--match-head-commit",
      "a".repeat(40),
      "--auto",
      "--squash",
    ]);
  });

  it.each([
    [
      "human author",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.user.login = "maintainer";
      },
    ],
    [
      "spoofed user type",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.user.type = "User";
      },
    ],
    [
      "fork head",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.head.repo.full_name = "fork/levi";
      },
    ],
    [
      "other base repository",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.base.repo.full_name = "other/levi";
      },
    ],
    [
      "other base branch",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.base.ref = "release";
      },
    ],
    [
      "closed PR",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.state = "closed";
      },
    ],
    [
      "draft PR",
      (pr: ReturnType<typeof event>["pull_request"]) => {
        pr.draft = true;
      },
    ],
  ] as const)("does not request a merge for %s", (_name, change) => {
    const payload = event();
    change(payload.pull_request);
    const result = run(payload);
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([]);
  });

  it("does not merge an event without PR metadata", () => {
    expect(run({}).calls).toEqual([]);
  });

  it("propagates GitHub errors, including head changes and permission failures", () => {
    expect(run(event(), 1).status).toBe(1);
  });

  it("does not execute repository code in the privileged workflow", () => {
    expect(workflow).not.toMatch(
      /\buses:|\bcheckout\b|\b(?:pnpm|npm|npx|curl|wget)\b|--admin/,
    );
    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain(
      "types: [opened, synchronize, reopened, ready_for_review]",
    );
    expect(workflow).toContain("permissions: {}");
  });
});
