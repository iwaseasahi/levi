import { spawnSync } from "node:child_process";

const e2eEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public",
};

function run(args: string[], env = process.env) {
  const result = spawnSync("pnpm", args, { env, stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.CI !== "true") {
  run(["db:up"]);
}
run(["exec", "prisma", "generate"], e2eEnvironment);
run(["exec", "prisma", "migrate", "deploy"], e2eEnvironment);
run(["exec", "playwright", "test"], e2eEnvironment);
