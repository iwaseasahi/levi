import { spawnSync } from "node:child_process";

import { assertDedicatedTestEnvironment } from "../../src/infrastructure/database/test-database-guard";

export class TestCommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
  ) {
    super(`${command} exited with status ${exitCode}`);
    this.name = "TestCommandError";
  }
}

type RunPnpmOptions = {
  exitOnFailure?: boolean;
};

export function runPnpm(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  options: RunPnpmOptions = {},
) {
  const result = spawnSync("pnpm", [...args], {
    env: environment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const exitCode = result.status ?? 1;
    if (options.exitOnFailure !== false) process.exit(exitCode);
    throw new TestCommandError(`pnpm ${args.join(" ")}`, exitCode);
  }
}

type PrepareTestDatabaseOptions = RunPnpmOptions & {
  localSetupScript?: "db:up:test" | "db:up:e2e";
};

export function prepareTestDatabase(
  environment: NodeJS.ProcessEnv,
  options: PrepareTestDatabaseOptions = {},
) {
  assertDedicatedTestEnvironment(environment);
  if (process.env.CI !== "true") {
    runPnpm([options.localSetupScript ?? "db:up:test"], process.env, options);
  }
  runPnpm(["exec", "prisma", "generate"], environment, options);
  runPnpm(["exec", "prisma", "migrate", "deploy"], environment, options);
}
