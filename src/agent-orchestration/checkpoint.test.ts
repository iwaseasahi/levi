import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  createWorkspacePatch,
  verifyCheckpoint,
  writeCheckpoint,
} from "./checkpoint";

const execFile = promisify(execFileCallback);

describe("checkpoint", () => {
  it("writes an integrity-bound manifest and patch", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "levi-checkpoint-"));
    const manifest = await writeCheckpoint(
      directory,
      {
        schema_version: 1,
        issue: 2,
        run_id: "run-1",
        provider: "codex",
        model: null,
        base_sha: "abc123",
        branch: "codex/issue-2",
        worktree: "/repo",
        created_at: "2026-08-21T00:00:00.000Z",
        completed_steps: ["implemented"],
        changed_files: ["src/example.ts"],
        verification: [],
        remaining_work: ["review"],
        blocker: "usage_limit_reached",
        switch_reason: "openai_usage_limit",
        retry_after: null,
      },
      "diff --git a/a b/a\n",
    );

    expect(manifest.patch_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifyCheckpoint(directory)).toBe(true);
    expect(
      await readFile(path.join(directory, "changes.patch"), "utf8"),
    ).toContain("diff --git");
  });

  it("includes untracked source files but excludes runtime artifacts", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "levi-workspace-"));
    await execFile("git", ["init"], { cwd: workspace });
    await execFile("git", ["config", "user.email", "test@example.invalid"], {
      cwd: workspace,
    });
    await execFile("git", ["config", "user.name", "Test"], { cwd: workspace });
    await writeFile(
      path.join(workspace, "tracked.ts"),
      "export const old = 1;\n",
    );
    await execFile("git", ["add", "tracked.ts"], { cwd: workspace });
    await execFile("git", ["commit", "-m", "base"], { cwd: workspace });

    await writeFile(
      path.join(workspace, "tracked.ts"),
      "export const old = 2;\n",
    );
    await mkdir(path.join(workspace, "src"));
    await writeFile(
      path.join(workspace, "src/new.ts"),
      "export const added = 1;\n",
    );
    await mkdir(path.join(workspace, "agent-artifacts"));
    await writeFile(
      path.join(workspace, "agent-artifacts/provider-output.json"),
      '{"secret":"must-not-be-checkpointed"}\n',
    );

    const result = await createWorkspacePatch(workspace);

    expect(result.changedFiles).toEqual(["src/new.ts", "tracked.ts"]);
    expect(result.patch).toContain("diff --git a/src/new.ts b/src/new.ts");
    expect(result.patch).toContain("new file mode 100644");
    expect(result.patch).not.toContain("agent-artifacts");
    expect(result.patch).not.toContain("must-not-be-checkpointed");
  });
});
