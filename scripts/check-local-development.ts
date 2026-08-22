import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import nextConfig from "../next.config";
import { planLocalEnvironment } from "./lib/local-environment";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const packageJson = JSON.parse(read("package.json")) as {
  engines?: Record<string, string>;
  packageManager?: string;
  scripts?: Record<string, string>;
};
const mise = read("mise.toml");
const setup = read("scripts/setup-local.sh");
const e2eRunner = read("scripts/run-e2e-tests.ts");
const compose = read("compose.yaml");
const ci = read(".github/workflows/ci.yml");

assert(read(".node-version").trim() === "24.19.0", ".node-version drifted");
assert(
  /^node = "24\.19\.0"$/m.test(mise),
  "mise.toml must pin Node.js 24.19.0",
);
assert(
  packageJson.engines?.node === ">=24.0.0 <25",
  "package.json must continue to allow only Node.js 24",
);
assert(
  packageJson.packageManager === "pnpm@11.19.0",
  "packageManager must pin pnpm 11.19.0",
);
assert(
  nextConfig.devIndicators === false,
  "Next.js development indicators must remain hidden from Levi screens",
);
assert(
  ci.includes("node-version: 24.19.0") && ci.includes("version: 11.19.0"),
  "CI runtime pins must match the local Node.js and pnpm pins",
);

for (const task of ["setup", "dev", "smoke", "stop", "check"]) {
  assert(
    new RegExp(`^\\[tasks\\.${task}\\]$`, "m").test(mise),
    `mise.toml is missing the ${task} task`,
  );
}
assert(
  mise.includes(
    'DATABASE_URL = "postgresql://levi:levi@127.0.0.1:55432/levi?schema=public"',
  ) && mise.includes('BETTER_AUTH_BASE_URL = "https://levi.local.test"'),
  "The local check must use the development DB and a synthetic HTTPS origin",
);

assert(
  packageJson.scripts?.["db:up:dev"] === "docker compose up -d --wait postgres",
  "local setup must target only the development PostgreSQL service",
);
assert(
  packageJson.scripts?.["db:stop:dev"] === "docker compose stop postgres",
  "local stop must preserve data and target only development PostgreSQL",
);
assert(
  compose.startsWith("name: levi\n"),
  "Compose project name must remain stable across repository worktrees",
);
assert(
  e2eRunner.includes(
    'process.env.E2E_BETTER_AUTH_BASE_URL ?? "http://127.0.0.1:3100"',
  ) &&
    e2eRunner.includes(
      'process.env.E2E_BETTER_AUTH_TRUSTED_ORIGINS ?? "http://127.0.0.1:3100"',
    ),
  "Local E2E must use its own explicit auth origin",
);

for (const signal of [
  "pnpm install --frozen-lockfile",
  "pnpm local:env:prepare",
  "pnpm db:up:dev",
  "pnpm db:generate",
  "pnpm db:migrate",
  "pnpm db:seed",
]) {
  assert(setup.includes(signal), `Local setup is missing: ${signal}`);
}
const shellSyntax = spawnSync("bash", ["-n", "scripts/setup-local.sh"], {
  cwd: repositoryRoot,
});
assert(shellSyntax.status === 0, "Local setup shell syntax is invalid");

const example = "FIRST=example\nSECOND=added\n";
const current = "FIRST=operator-value\nCUSTOM=preserved\n";
const firstPlan = planLocalEnvironment(example, current);
assert(!firstPlan.created, "An existing .env must not be recreated");
assert(
  firstPlan.content.includes("FIRST=operator-value"),
  "An existing .env value was replaced",
);
assert(
  firstPlan.content.includes("CUSTOM=preserved"),
  "An unrelated .env value was removed",
);
assert(
  firstPlan.content === `${current}${firstPlan.appendix}`,
  "Existing .env content must only receive an appendix",
);
assert(
  firstPlan.addedKeys.length === 1 && firstPlan.addedKeys[0] === "SECOND",
  "Only missing example keys should be appended",
);
const secondPlan = planLocalEnvironment(example, firstPlan.content);
assert(
  secondPlan.addedKeys.length === 0 && secondPlan.content === firstPlan.content,
  "Local environment preparation must be idempotent",
);

process.stdout.write("Local development configuration passed.\n");
