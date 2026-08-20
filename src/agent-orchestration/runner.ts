import { spawn } from "node:child_process";

import { classifyAgentFailure } from "./classify";
import { providerCommand } from "./commands";
import type { AgentRunResult, Provider } from "./types";

interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunAgentInput {
  issue: number;
  runId: string;
  provider: Provider;
  workspace: string;
  prompt: string;
  model?: string;
  maxAttempts?: number;
  timeoutMs?: number;
  maxBudgetUsd?: number;
  execute?: (
    command: string,
    args: string[],
    prompt: string,
    timeoutMs: number,
  ) => Promise<ProcessResult>;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

export async function executeProcess(
  command: string,
  args: string[],
  prompt: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${error.message}`,
        timedOut,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
    child.stdin.end(prompt);
  });
}

export async function runAgent(input: RunAgentInput): Promise<AgentRunResult> {
  const startedAt = new Date();
  const maxAttempts = input.maxAttempts ?? 3;
  const execute = input.execute ?? executeProcess;
  const sleep =
    input.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = input.random ?? Math.random;
  const command = providerCommand(input);
  let processResult: ProcessResult = {
    exitCode: null,
    stdout: "",
    stderr: "",
    timedOut: false,
  };
  let status: AgentRunResult["status"] = "agent_failed";
  let attempts = 0;

  for (attempts = 1; attempts <= maxAttempts; attempts += 1) {
    processResult = await execute(
      command.executable,
      command.args,
      input.prompt,
      input.timeoutMs ?? 45 * 60_000,
    );
    status = classifyAgentFailure({
      exitCode: processResult.exitCode,
      output: `${processResult.stdout}\n${processResult.stderr}`,
      timedOut: processResult.timedOut,
    });
    if (status !== "rate_limited_transient" || attempts === maxAttempts) break;
    const jitteredDelay = Math.round(
      2_000 * 2 ** (attempts - 1) * (0.75 + random() * 0.5),
    );
    await sleep(jitteredDelay);
  }

  return {
    schema_version: 1,
    issue: input.issue,
    run_id: input.runId,
    provider: input.provider,
    status,
    attempts,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    retry_after: null,
    exit_code: processResult.exitCode,
    summary:
      status === "succeeded"
        ? "Agent process completed."
        : `Agent process classified as ${status}.`,
  };
}
