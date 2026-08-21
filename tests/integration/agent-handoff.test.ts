import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { writeCheckpoint } from "../../src/agent-orchestration/checkpoint";

const execFile = promisify(execFileCallback);
const repositoryRoot = process.cwd();

async function runAgentHandoff(args: string[]) {
  return execFile("pnpm", ["agent:checkpoint:verify", ...args], {
    cwd: repositoryRoot,
  });
}

describe("local agent handoff CLI", () => {
  it("requires checkpoint output to stay under the ignored agent state", async () => {
    const outsideDirectory = await mkdtemp(
      path.join(tmpdir(), "levi-outside-handoff-"),
    );

    await expect(
      execFile(
        "pnpm",
        [
          "agent:checkpoint",
          "--workspace",
          repositoryRoot,
          "--output-dir",
          outsideDirectory,
          "--issue",
          "2",
          "--run-id",
          "test",
          "--provider",
          "codex",
          "--base-sha",
          "abcdef0",
          "--branch",
          "codex/issue-2",
        ],
        { cwd: repositoryRoot },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "output-dir must be inside the workspace .agent-runs directory",
      ),
    });
  });

  it("requires the receiver to verify Issue and base SHA", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "levi-handoff-"));
    await writeCheckpoint(
      directory,
      {
        schema_version: 1,
        issue: 2,
        run_id: "test",
        provider: "codex",
        model: null,
        base_sha: "abcdef0",
        branch: "codex/issue-2",
        worktree: repositoryRoot,
        created_at: "2026-08-21T00:00:00.000Z",
        completed_steps: [],
        changed_files: [],
        verification: [],
        remaining_work: [],
        blocker: null,
        switch_reason: null,
        retry_after: null,
      },
      "",
    );

    await expect(
      runAgentHandoff(["--directory", directory]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing --expected-issue"),
    });
    await expect(
      runAgentHandoff([
        "--directory",
        directory,
        "--expected-issue",
        "2",
        "--expected-base-sha",
        "abcdef0",
      ]),
    ).resolves.toMatchObject({ stdout: expect.stringContaining('"issue":2') });
  });

  it("rejects mistyped options", async () => {
    await expect(
      runAgentHandoff(["--directry", "/tmp/missing"]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unsupported option: --directry"),
    });
  });
});
