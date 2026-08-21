import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createWorkspacePatch,
  readCheckpoint,
  verifyCheckpoint,
  writeCheckpoint,
} from "../src/agent-orchestration/checkpoint";
import { acquireLease, releaseLease } from "../src/agent-orchestration/lease";
import {
  agentStatuses,
  type AgentStatus,
  type Provider,
  type VerificationRecord,
} from "../src/agent-orchestration/types";

function parseArgs(values: string[], allowed: ReadonlySet<string>) {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(
        `Expected --key value, received: ${values.slice(index).join(" ")}`,
      );
    }
    const name = key.slice(2);
    if (!allowed.has(name)) throw new Error(`Unsupported option: --${name}`);
    if (parsed.has(name)) throw new Error(`Duplicate option: --${name}`);
    parsed.set(name, value);
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
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function provider(value: string): Provider {
  if (value !== "codex") throw new Error("provider must be codex");
  return value;
}

function baseSha(value: string): string {
  if (value.length < 7)
    throw new Error("base-sha must be at least 7 characters");
  return value;
}

function optionalDate(value: string | undefined, label: string): string | null {
  if (!value) return null;
  if (Number.isNaN(Date.parse(value)))
    throw new Error(`${label} must be a date-time`);
  return value;
}

function checkpointDirectory(
  workspace: string,
  outputDirectory: string,
): string {
  const root = path.resolve(workspace, ".agent-runs");
  const output = path.resolve(outputDirectory);
  const relative = path.relative(root, output);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "output-dir must be inside the workspace .agent-runs directory",
    );
  }
  return output;
}

function blocker(value: string | undefined): AgentStatus | null {
  if (!value || value === "succeeded") return null;
  if (!agentStatuses.includes(value as AgentStatus))
    throw new Error(`Unsupported blocker status: ${value}`);
  return value as AgentStatus;
}

async function stringListFile(
  args: Map<string, string>,
  key: string,
): Promise<string[]> {
  const file = args.get(key);
  if (!file) return [];
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw new Error(`--${key} must contain a JSON array of non-empty strings`);
  }
  return value;
}

async function verificationFile(
  args: Map<string, string>,
): Promise<VerificationRecord[]> {
  const file = args.get("verification-file");
  if (!file) return [];
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  if (
    !Array.isArray(value) ||
    !value.every(
      (record): record is VerificationRecord =>
        typeof record === "object" &&
        record !== null &&
        Object.keys(record).length === 3 &&
        typeof (record as VerificationRecord).command === "string" &&
        ["passed", "failed", "not_run"].includes(
          (record as VerificationRecord).status,
        ) &&
        typeof (record as VerificationRecord).summary === "string",
    )
  ) {
    throw new Error(
      "--verification-file must contain command/status/summary records",
    );
  }
  return value;
}

async function checkpoint(args: Map<string, string>) {
  const workspace = path.resolve(required(args, "workspace"));
  const outputDirectory = checkpointDirectory(
    workspace,
    required(args, "output-dir"),
  );
  const { patch, changedFiles } = await createWorkspacePatch(workspace);
  const manifest = await writeCheckpoint(
    outputDirectory,
    {
      schema_version: 1,
      issue: positiveNumber(required(args, "issue"), "issue"),
      run_id: required(args, "run-id"),
      provider: provider(required(args, "provider")),
      model: args.get("model") ?? null,
      base_sha: baseSha(required(args, "base-sha")),
      branch: required(args, "branch"),
      worktree: workspace,
      created_at: new Date().toISOString(),
      completed_steps: await stringListFile(args, "completed-steps-file"),
      changed_files: changedFiles,
      verification: await verificationFile(args),
      remaining_work: await stringListFile(args, "remaining-work-file"),
      blocker: blocker(args.get("blocker")),
      switch_reason: args.get("switch-reason") ?? null,
      retry_after: optionalDate(args.get("retry-after"), "retry-after"),
    },
    patch,
  );
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

async function verify(args: Map<string, string>) {
  const directory = required(args, "directory");
  if (!(await verifyCheckpoint(directory)))
    throw new Error("Checkpoint integrity verification failed");
  const manifest = await readCheckpoint(directory);
  const expectedIssue = positiveNumber(
    required(args, "expected-issue"),
    "expected-issue",
  );
  const expectedBaseSha = baseSha(required(args, "expected-base-sha"));
  if (manifest.issue !== expectedIssue) {
    throw new Error("Checkpoint Issue does not match --expected-issue");
  }
  if (manifest.base_sha !== expectedBaseSha) {
    throw new Error("Checkpoint base SHA does not match --expected-base-sha");
  }
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
const options: Record<string, ReadonlySet<string>> = {
  checkpoint: new Set([
    "workspace",
    "output-dir",
    "issue",
    "run-id",
    "provider",
    "model",
    "base-sha",
    "branch",
    "completed-steps-file",
    "verification-file",
    "remaining-work-file",
    "blocker",
    "switch-reason",
    "retry-after",
  ]),
  verify: new Set(["directory", "expected-issue", "expected-base-sha"]),
  lease: new Set([
    "action",
    "directory",
    "issue",
    "run-id",
    "provider",
    "branch",
    "ttl-minutes",
  ]),
};

try {
  if (!command || !options[command])
    throw new Error("Expected checkpoint, verify, or lease command");
  const args = parseArgs(rawArgs, options[command]);
  if (command === "checkpoint") await checkpoint(args);
  else if (command === "verify") await verify(args);
  else if (command === "lease") await lease(args);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
