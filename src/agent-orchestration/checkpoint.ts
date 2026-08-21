import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { HandoffManifest } from "./types";

const execFile = promisify(execFileCallback);

export async function createWorkspacePatch(workspace: string): Promise<{
  patch: string;
  changedFiles: string[];
}> {
  const { stdout: untrackedOutput } = await execFile(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: workspace, encoding: "buffer" },
  );
  const untrackedFiles = untrackedOutput
    .toString("utf8")
    .split("\0")
    .filter(
      (file) =>
        file.length > 0 &&
        file !== "agent-artifacts" &&
        !file.startsWith("agent-artifacts/"),
    );

  if (untrackedFiles.length > 0) {
    await execFile("git", ["add", "--intent-to-add", "--", ...untrackedFiles], {
      cwd: workspace,
      maxBuffer: 50 * 1024 * 1024,
    });
  }

  try {
    const [{ stdout: patch }, { stdout: files }] = await Promise.all([
      execFile("git", ["diff", "--binary", "HEAD"], {
        cwd: workspace,
        maxBuffer: 50 * 1024 * 1024,
      }),
      execFile("git", ["diff", "--name-only", "HEAD"], { cwd: workspace }),
    ]);
    return {
      patch,
      changedFiles: files.trim() ? files.trim().split("\n") : [],
    };
  } finally {
    if (untrackedFiles.length > 0) {
      await execFile("git", ["reset", "--quiet", "--", ...untrackedFiles], {
        cwd: workspace,
        maxBuffer: 50 * 1024 * 1024,
      });
    }
  }
}

export async function writeCheckpoint(
  directory: string,
  manifest: Omit<HandoffManifest, "patch_sha256">,
  patch: string,
): Promise<HandoffManifest> {
  await mkdir(directory, { recursive: true });
  const patchPath = path.join(directory, "changes.patch");
  const manifestPath = path.join(directory, "handoff.json");
  const patchSha256 = patch
    ? createHash("sha256").update(patch).digest("hex")
    : null;
  const completeManifest: HandoffManifest = {
    ...manifest,
    patch_sha256: patchSha256,
  };
  const nonce = `${process.pid}-${Date.now()}`;
  const temporaryPatch = `${patchPath}.${nonce}.tmp`;
  const temporaryManifest = `${manifestPath}.${nonce}.tmp`;
  await writeFile(temporaryPatch, patch, { mode: 0o600 });
  await writeFile(
    temporaryManifest,
    `${JSON.stringify(completeManifest, null, 2)}\n`,
    { mode: 0o600 },
  );
  await rename(temporaryPatch, patchPath);
  await rename(temporaryManifest, manifestPath);
  return completeManifest;
}

export async function verifyCheckpoint(directory: string): Promise<boolean> {
  const [manifestText, patch] = await Promise.all([
    readFile(path.join(directory, "handoff.json"), "utf8"),
    readFile(path.join(directory, "changes.patch"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as HandoffManifest;
  const actual = patch
    ? createHash("sha256").update(patch).digest("hex")
    : null;
  return manifest.schema_version === 1 && manifest.patch_sha256 === actual;
}
