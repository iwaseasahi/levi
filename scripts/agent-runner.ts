import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  classifyAgentFailure,
  shouldFallback,
} from "../src/agent-orchestration/classify";
import { writeCheckpoint } from "../src/agent-orchestration/checkpoint";
import { acquireLease, releaseLease } from "../src/agent-orchestration/lease";
import { runAgent } from "../src/agent-orchestration/runner";
import type {
  AgentRunResult,
  AgentStatus,
  Provider,
  VerificationRecord,
} from "../src/agent-orchestration/types";

const execFile = promisify(execFileCallback);

function parseArgs(values: string[]) {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(
        `Expected --key value, received: ${values.slice(index).join(" ")}`,
      );
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) throw new Error(`Missing --${key}`);
  return value;
}

function positiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${label} must be positive`);
  return parsed;
}

function provider(value: string): Provider {
  if (value !== "codex" && value !== "claude")
    throw new Error("provider must be codex or claude");
  return value;
}

async function run(args: Map<string, string>) {
  const model = args.get("model");
  const result = await runAgent({
    issue: positiveNumber(required(args, "issue"), "issue"),
    runId: required(args, "run-id"),
    provider: provider(required(args, "provider")),
    workspace: required(args, "workspace"),
    prompt: await readFile(required(args, "prompt-file"), "utf8"),
    ...(model ? { model } : {}),
    maxAttempts: positiveNumber(
      args.get("max-attempts") ?? "3",
      "max-attempts",
    ),
    timeoutMs: positiveNumber(
      args.get("timeout-ms") ?? "2700000",
      "timeout-ms",
    ),
    ...(args.get("max-budget-usd")
      ? {
          maxBudgetUsd: positiveNumber(
            required(args, "max-budget-usd"),
            "max-budget-usd",
          ),
        }
      : {}),
  });
  await writeFile(
    required(args, "result"),
    `${JSON.stringify(result, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function route(args: Map<string, string>) {
  const result = JSON.parse(
    await readFile(required(args, "result"), "utf8"),
  ) as AgentRunResult;
  const fallback = shouldFallback(result.status, result.attempts);
  const route = { status: result.status, fallback };
  if (args.get("github-output")) {
    await writeFile(
      required(args, "github-output"),
      `status=${result.status}\nfallback=${fallback}\n`,
      { flag: "a" },
    );
  }
  process.stdout.write(`${JSON.stringify(route)}\n`);
}

async function normalize(args: Map<string, string>) {
  const [stdout, stderr, exitCodeText, attemptsText] = await Promise.all([
    readFile(required(args, "stdout-file"), "utf8"),
    readFile(required(args, "stderr-file"), "utf8"),
    readFile(required(args, "exit-code-file"), "utf8"),
    readFile(required(args, "attempts-file"), "utf8"),
  ]);
  const exitCode = Number(exitCodeText.trim());
  const attempts = positiveNumber(attemptsText.trim(), "attempts");
  if (!Number.isInteger(exitCode))
    throw new Error("exit-code must be an integer");
  const status = classifyAgentFailure({
    exitCode,
    output: `${stdout}\n${stderr}`,
  });
  const timestamp = new Date().toISOString();
  const result: AgentRunResult = {
    schema_version: 1,
    issue: positiveNumber(required(args, "issue"), "issue"),
    run_id: required(args, "run-id"),
    provider: provider(required(args, "provider")),
    status,
    attempts,
    started_at: timestamp,
    finished_at: timestamp,
    retry_after: null,
    exit_code: exitCode,
    summary:
      status === "succeeded"
        ? "Agent process completed."
        : `Agent process classified as ${status}.`,
  };
  await writeFile(
    required(args, "result"),
    `${JSON.stringify(result, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function checkpoint(args: Map<string, string>) {
  const workspace = required(args, "workspace");
  const [{ stdout: patch }, { stdout: files }] = await Promise.all([
    execFile("git", ["diff", "--binary", "HEAD"], {
      cwd: workspace,
      maxBuffer: 50 * 1024 * 1024,
    }),
    execFile("git", ["diff", "--name-only", "HEAD"], { cwd: workspace }),
  ]);
  const verification = args.get("verification-file")
    ? (JSON.parse(
        await readFile(required(args, "verification-file"), "utf8"),
      ) as VerificationRecord[])
    : [];
  const blockerValue = args.get("blocker") ?? null;
  const manifest = await writeCheckpoint(
    required(args, "output-dir"),
    {
      schema_version: 1,
      issue: positiveNumber(required(args, "issue"), "issue"),
      run_id: required(args, "run-id"),
      provider: provider(required(args, "provider")),
      model: args.get("model") ?? null,
      base_sha: required(args, "base-sha"),
      branch: required(args, "branch"),
      worktree: workspace,
      created_at: new Date().toISOString(),
      completed_steps: [],
      changed_files: files.trim() ? files.trim().split("\n") : [],
      verification,
      remaining_work: [],
      blocker:
        blockerValue === "succeeded"
          ? null
          : (blockerValue as AgentStatus | null),
      switch_reason: args.get("switch-reason") ?? null,
      retry_after: args.get("retry-after") ?? null,
    },
    patch,
  );
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

async function lease(args: Map<string, string>) {
  const action = required(args, "action");
  const directory = required(args, "directory");
  const issue = positiveNumber(required(args, "issue"), "issue");
  const runId = required(args, "run-id");
  if (action === "release") {
    await releaseLease(directory, issue, runId);
    return;
  }
  if (action !== "acquire")
    throw new Error("lease action must be acquire or release");
  const acquiredAt = new Date();
  const ttlMinutes = positiveNumber(
    args.get("ttl-minutes") ?? "60",
    "ttl-minutes",
  );
  await acquireLease(directory, {
    schema_version: 1,
    issue,
    run_id: runId,
    provider: provider(required(args, "provider")),
    branch: required(args, "branch"),
    acquired_at: acquiredAt.toISOString(),
    expires_at: new Date(
      acquiredAt.getTime() + ttlMinutes * 60_000,
    ).toISOString(),
  });
}

const [command, ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs);

try {
  if (command === "run") await run(args);
  else if (command === "normalize") await normalize(args);
  else if (command === "route") await route(args);
  else if (command === "checkpoint") await checkpoint(args);
  else if (command === "lease") await lease(args);
  else
    throw new Error(
      "Expected run, normalize, route, checkpoint, or lease command",
    );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
