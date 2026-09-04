import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  createProductionDependencySbom,
  evaluateOsvAuditReport,
} from "../src/operations/osv-audit";

const scannerVersion = "2.5.1";
const scannerChecksums: Record<string, string> = {
  "darwin-arm64":
    "75c44d6332f892a1e56286f4105a98ed751ae28d215ca0a8b65cc00d84103054",
  "darwin-x64":
    "9f89beb6c3d784893cb1cae0a3d56c529bfe91075418c2f9440c45b79654198b",
  "linux-arm64":
    "3d0f5aa5a6baa8eb32bcef247388e149ef6030a6634ccae6fa0d62681fb27a6d",
  "linux-x64":
    "f9f25499a2c8cc367b3af45df2ea7eeca7fbccceab9c35079968f4b3652194be",
};

function scannerAsset(): { checksum: string; name: string } {
  const key = `${process.platform}-${process.arch}`;
  const checksum = scannerChecksums[key];
  if (!checksum) throw new Error(`OSV_SCANNER_PLATFORM_UNSUPPORTED: ${key}`);
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const architecture = process.arch === "arm64" ? "arm64" : "amd64";
  return { checksum, name: `osv-scanner_${platform}_${architecture}` };
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function download(url: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw new Error(`OSV_SCANNER_DOWNLOAD_FAILED: ${String(lastError)}`);
}

async function ensureScanner(): Promise<string> {
  const asset = scannerAsset();
  const directory = path.join(tmpdir(), `levi-osv-scanner-${scannerVersion}`);
  const executable = path.join(directory, asset.name);

  if (existsSync(executable)) {
    const installed = readFileSync(executable);
    if (sha256(installed) === asset.checksum) return executable;
  }

  mkdirSync(directory, { recursive: true });
  const url = `https://github.com/google/osv-scanner/releases/download/v${scannerVersion}/${asset.name}`;
  const downloaded = await download(url);
  if (sha256(downloaded) !== asset.checksum) {
    throw new Error("OSV_SCANNER_CHECKSUM_MISMATCH");
  }

  const temporary = `${executable}.${process.pid}.tmp`;
  writeFileSync(temporary, downloaded, { mode: 0o700 });
  renameSync(temporary, executable);
  chmodSync(executable, 0o700);
  return executable;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const reportDirectory = path.join(repositoryRoot, "test-results/security");
const reportPath = path.join(reportDirectory, "osv-results.json");
const sbomPath = path.join(reportDirectory, "production-dependencies.cdx.json");
mkdirSync(reportDirectory, { recursive: true });
rmSync(reportPath, { force: true });

const inventory = spawnSync("pnpm", ["licenses", "list", "--prod", "--json"], {
  encoding: "utf8",
  timeout: 60_000,
});
if (inventory.error) throw inventory.error;
if (inventory.status !== 0) {
  process.stderr.write(inventory.stderr);
  throw new Error(
    `PRODUCTION_DEPENDENCY_INVENTORY_FAILED: exit ${String(inventory.status)}`,
  );
}
const sbom = createProductionDependencySbom(
  JSON.parse(inventory.stdout) as unknown,
);
writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");

const scanner = await ensureScanner();
const scan = spawnSync(
  scanner,
  [
    "scan",
    "source",
    `--lockfile=${sbomPath}`,
    "--format=json",
    `--output-file=${reportPath}`,
  ],
  { encoding: "utf8", timeout: 300_000 },
);

process.stdout.write(scan.stdout);
process.stderr.write(scan.stderr);
if (scan.error) throw scan.error;
if (scan.status !== 0 && scan.status !== 1) {
  throw new Error(`OSV_SCANNER_FAILED: exit ${String(scan.status)}`);
}

const evaluation = evaluateOsvAuditReport(
  JSON.parse(readFileSync(reportPath, "utf8")) as unknown,
);

for (const finding of evaluation.findings) {
  const severity =
    finding.score === null ? "unknown" : finding.score.toFixed(1);
  process.stdout.write(
    `OSV ${finding.ids.join("/")} ${finding.packageName}@${finding.version} severity ${severity}\n`,
  );
}

if (evaluation.blocking.length > 0) {
  throw new Error(
    `OSV_AUDIT_HIGH_OR_UNKNOWN_SEVERITY: ${evaluation.blocking
      .map(
        (finding) =>
          `${finding.packageName}@${finding.version}:${finding.ids[0]}`,
      )
      .join(", ")}`,
  );
}

process.stdout.write(
  `OSV audit passed: ${evaluation.findings.length} known production vulnerability group(s), none high or critical.\n`,
);
