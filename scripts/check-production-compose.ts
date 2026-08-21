import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

interface ComposeService {
  cap_drop?: string[];
  healthcheck?: unknown;
  image?: string;
  networks?: Record<string, unknown>;
  ports?: unknown[];
  read_only?: boolean;
  restart?: string;
  security_opt?: string[];
  user?: string;
}

interface ComposeConfig {
  networks: Record<string, { internal?: boolean }>;
  services: Record<string, ComposeService>;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const composeFile = path.join(
  repositoryRoot,
  "deploy",
  "production",
  "compose.yaml",
);
const exampleEnvironment = path.join(
  repositoryRoot,
  "deploy",
  "production",
  "production.env.example",
);

const result = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    exampleEnvironment,
    "-f",
    composeFile,
    "config",
    "--format",
    "json",
  ],
  { cwd: repositoryRoot, encoding: "utf8" },
);

if (result.status !== 0) {
  throw new Error(
    `Production Compose configuration is invalid:\n${result.stderr || result.stdout}`,
  );
}

const config = JSON.parse(result.stdout) as ComposeConfig;
const requiredServices = ["proxy", "app", "postgres"] as const;

for (const serviceName of requiredServices) {
  const service = config.services[serviceName];
  assert(service, `Missing ${serviceName} service`);
  assert.equal(service.restart, "unless-stopped");
  assert(service.security_opt?.includes("no-new-privileges:true"));
}

for (const serviceName of ["proxy", "postgres"] as const) {
  assert.match(
    config.services[serviceName]?.image ?? "",
    /@sha256:[a-f0-9]{64}$/,
    `${serviceName} image must be pinned by digest`,
  );
}

const app = config.services.app!;
assert.equal(app.user, "1000:1000");
assert.equal(app.read_only, true);
assert(app.cap_drop?.includes("ALL"));
assert.deepEqual(Object.keys(app.networks ?? {}), ["private"]);
assert(app.healthcheck, "app must define a readiness healthcheck");

const postgres = config.services.postgres!;
assert.equal(postgres.read_only, true);
assert(postgres.cap_drop?.includes("ALL"));
assert(postgres.healthcheck, "PostgreSQL must define a healthcheck");
assert.equal(postgres.ports, undefined, "PostgreSQL must not publish a port");
assert.deepEqual(Object.keys(postgres.networks ?? {}), ["private"]);
assert.equal(config.networks.private?.internal, true);

const proxy = config.services.proxy!;
assert.equal(proxy.read_only, true);
assert(proxy.ports && proxy.ports.length === 3);

console.log("Production Compose configuration passed security invariants.");
