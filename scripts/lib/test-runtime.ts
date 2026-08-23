import { spawnSync } from "node:child_process";

export function runPnpm(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const result = spawnSync("pnpm", [...args], {
    env: environment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function prepareTestDatabase(environment: NodeJS.ProcessEnv) {
  if (process.env.CI !== "true") runPnpm(["db:up"]);
  runPnpm(["exec", "prisma", "generate"], environment);
  runPnpm(["exec", "prisma", "migrate", "deploy"], environment);
}
