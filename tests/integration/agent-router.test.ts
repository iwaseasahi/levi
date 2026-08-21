import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

  it("normalizes provider output after the credential-bearing step", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "levi-normalize-"));
    await Promise.all([
      writeFile(path.join(directory, "stdout.log"), ""),
      writeFile(
        path.join(directory, "stderr.log"),
        "HTTP 429 too many requests",
      ),
      writeFile(path.join(directory, "exit-code.txt"), "1\n"),
      writeFile(path.join(directory, "attempts.txt"), "3\n"),
    ]);
    const resultPath = path.join(directory, "result.json");
    await execute(
      "pnpm",
      [
        "agent:normalize",
        "--provider",
        "codex",
        "--issue",
        "2",
        "--run-id",
        "integration-normalize",
        "--stdout-file",
        path.join(directory, "stdout.log"),
        "--stderr-file",
        path.join(directory, "stderr.log"),
        "--exit-code-file",
        path.join(directory, "exit-code.txt"),
        "--attempts-file",
        path.join(directory, "attempts.txt"),
        "--result",
        resultPath,
      ],
      { cwd: process.cwd() },
    );

    const normalized = JSON.parse(await readFile(resultPath, "utf8")) as {
      status: string;
      attempts: number;
    };
    expect(normalized).toMatchObject({
      status: "rate_limited_transient",
      attempts: 3,
    });
  });
});
