import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptNames = [
  "production-backup.sh",
  "production-restore.sh",
  "production-promote-restore.sh",
  "check-production-backups.sh",
  "rehearse-backup.sh",
];
const scriptPaths = scriptNames.map((name) =>
  path.join(repositoryRoot, "scripts", name),
);

const syntaxCheck = spawnSync("bash", ["-n", ...scriptPaths], {
  encoding: "utf8",
});
if (syntaxCheck.status !== 0) {
  throw new Error(syntaxCheck.stderr || syntaxCheck.stdout);
}

const backupScript = readFileSync(scriptPaths[0]!, "utf8");
assert.match(backupScript, /-aes-256-gcm/);
assert.match(backupScript, /rsa_padding_mode:oaep/);
assert.match(backupScript, /hourly" -type f -mmin \+2880 -delete/);
assert.match(backupScript, /daily" -type f -mmin \+20160 -delete/);
assert.match(backupScript, /capacity_limit.*80/);
assert.match(backupScript, /LEVI_COMPOSE_PROJECT_NAME/);

const restoreScript = readFileSync(scriptPaths[1]!, "utf8");
assert.match(restoreScript, /Restored database reconciliation failed/);
assert.match(restoreScript, /DELETE FROM sessions/);
assert.match(restoreScript, /remaining_sessions.*!= "0"/s);
assert.match(restoreScript, /LEVI_COMPOSE_PROJECT_NAME/);

const promoteScript = readFileSync(scriptPaths[2]!, "utf8");
assert.match(promoteScript, /approval_reference/);
assert.match(promoteScript, /proved_database.*restore_database/s);
assert.match(promoteScript, /compose stop proxy app/);

const hourlyTimer = readFileSync(
  path.join(
    repositoryRoot,
    "deploy/production/systemd/levi-backup-hourly.timer",
  ),
  "utf8",
);
const dailyTimer = readFileSync(
  path.join(
    repositoryRoot,
    "deploy/production/systemd/levi-backup-daily.timer",
  ),
  "utf8",
);
assert.match(hourlyTimer, /OnCalendar=hourly/);
assert.match(dailyTimer, /OnCalendar=\*-\*-\* 03:20:00/);

console.log("Backup and restore configuration passed safety invariants.");
