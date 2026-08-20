import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { acquireLease, ActiveLeaseError, releaseLease } from "./lease";

const lease = (runId: string, expiresAt: string) => ({
  schema_version: 1 as const,
  issue: 2,
  run_id: runId,
  provider: "codex" as const,
  branch: "codex/issue-2",
  acquired_at: "2026-08-21T00:00:00.000Z",
  expires_at: expiresAt,
});

describe("writer lease", () => {
  it("rejects a second live writer and permits takeover after expiry", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "levi-lease-"));
    await acquireLease(directory, lease("first", "2026-08-21T02:00:00.000Z"));
    await expect(
      acquireLease(
        directory,
        lease("second", "2026-08-21T03:00:00.000Z"),
        new Date("2026-08-21T01:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(ActiveLeaseError);
    await acquireLease(
      directory,
      lease("second", "2026-08-21T04:00:00.000Z"),
      new Date("2026-08-21T03:00:00.000Z"),
    );
    await releaseLease(directory, 2, "second");
  });
});
