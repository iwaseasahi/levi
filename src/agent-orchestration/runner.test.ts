import { describe, expect, it, vi } from "vitest";

import { executeProcess, runAgent } from "./runner";

describe("executeProcess", () => {
  it("passes the prompt on stdin and captures output", async () => {
    const result = await executeProcess(
      process.execPath,
      [
        "-e",
        "let value=''; process.stdin.on('data', chunk => value += chunk); process.stdin.on('end', () => process.stdout.write(value.toUpperCase()));",
      ],
      "handoff",
      1_000,
    );
    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "HANDOFF",
      stderr: "",
      timedOut: false,
    });
  });

  it("classifies an unavailable executable without throwing", async () => {
    const result = await executeProcess(
      "levi-command-that-does-not-exist",
      [],
      "",
      1_000,
    );
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain("ENOENT");
  });

  it("terminates a process at the configured timeout", async () => {
    const result = await executeProcess(
      process.execPath,
      ["-e", "setTimeout(() => {}, 10_000)"],
      "",
      10,
    );
    expect(result.timedOut).toBe(true);
  });
});

describe("runAgent", () => {
  it("retries transient limits with bounded exponential backoff", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "HTTP 429",
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "overloaded",
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
        timedOut: false,
      });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runAgent({
      issue: 2,
      runId: "run-1",
      provider: "codex",
      workspace: "/repo",
      prompt: "task",
      execute,
      sleep,
      random: () => 0.5,
    });

    expect(result.status).toBe("succeeded");
    expect(result.attempts).toBe(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 4_000);
  });

  it("does not retry authentication failures", async () => {
    const execute = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "invalid API key",
      timedOut: false,
    });
    const result = await runAgent({
      issue: 2,
      runId: "run-2",
      provider: "claude",
      workspace: "/repo",
      prompt: "task",
      execute,
    });
    expect(result.status).toBe("authentication_failed");
    expect(execute).toHaveBeenCalledOnce();
  });
});
