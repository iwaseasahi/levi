import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { WriterLease } from "./types";

export class ActiveLeaseError extends Error {}

function leasePath(directory: string, issue: number) {
  return path.join(directory, `issue-${issue}.json`);
}

export async function acquireLease(
  directory: string,
  lease: WriterLease,
  now = new Date(),
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const target = leasePath(directory, lease.issue);
  try {
    const handle = await open(target, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`);
    await handle.close();
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  const existing = JSON.parse(await readFile(target, "utf8")) as WriterLease;
  if (new Date(existing.expires_at) > now) {
    throw new ActiveLeaseError(
      `Issue ${lease.issue} is owned by ${existing.provider}/${existing.run_id} until ${existing.expires_at}`,
    );
  }
  const replacement = `${target}.${lease.run_id}.tmp`;
  await writeFile(replacement, `${JSON.stringify(lease, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(replacement, target);
}

export async function releaseLease(
  directory: string,
  issue: number,
  runId: string,
): Promise<void> {
  const target = leasePath(directory, issue);
  const existing = JSON.parse(await readFile(target, "utf8")) as WriterLease;
  if (existing.run_id !== runId) {
    throw new ActiveLeaseError(
      `Run ${runId} cannot release lease owned by ${existing.run_id}`,
    );
  }
  await unlink(target);
}
