import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("agent router CLI", () => {
  it("routes a synthetic exhausted transient rate limit to fallback", async () => {
    const { stdout } = await execute(
      "pnpm",
      ["agent:route", "--result", "tests/fixtures/agent-runs/rate-limit.json"],
      { cwd: process.cwd() },
    );

    expect(JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}")).toEqual({
      status: "rate_limited_transient",
      fallback: true,
    });
  });
});
