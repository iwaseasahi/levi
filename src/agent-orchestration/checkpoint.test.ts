import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { verifyCheckpoint, writeCheckpoint } from "./checkpoint";

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
});
