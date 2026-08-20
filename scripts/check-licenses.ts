import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const approvedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "EPL-2.0",
  "ISC",
  "LGPL-3.0-or-later",
  "MIT",
  "MIT and ISC",
  "Unlicense",
]);

interface PackageLicense {
  license?: string;
  name?: string;
  versions?: string[];
}

const result = spawnSync("pnpm", ["licenses", "list", "--prod", "--json"], {
  encoding: "utf8",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const raw = JSON.parse(result.stdout) as Record<string, PackageLicense[]>;
const report = Object.entries(raw)
  .flatMap(([license, packages]) =>
    packages.map((dependency) => ({
      license,
      name: dependency.name ?? "unknown",
      versions: dependency.versions ?? [],
    })),
  )
  .sort((left, right) =>
    `${left.license}:${left.name}`.localeCompare(
      `${right.license}:${right.name}`,
    ),
  );

mkdirSync("test-results/security", { recursive: true });
writeFileSync(
  "test-results/security/licenses.json",
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const rejected = [...new Set(Object.keys(raw))].filter(
  (license) => !approvedLicenses.has(license),
);

if (rejected.length > 0) {
  throw new Error(
    `Unreviewed production dependency licenses: ${rejected.join(", ")}`,
  );
}

process.stdout.write(
  `Approved ${report.length} production dependency license records.\n`,
);
