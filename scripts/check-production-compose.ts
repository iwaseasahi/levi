import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

interface ComposeService {
  cap_drop?: string[];
  healthcheck?: unknown;
  image?: string;
  environment?: Record<string, string>;
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
const composeSource = readFileSync(composeFile, "utf8");
const caddySource = readFileSync(
  path.join(repositoryRoot, "deploy", "production", "Caddyfile"),
  "utf8",
);
const rehearsalSource = readFileSync(
  path.join(repositoryRoot, "scripts", "rehearse-production-compose.sh"),
  "utf8",
);
const workloadSource = readFileSync(
  path.join(repositoryRoot, "scripts", "lib", "production-workload.mjs"),
  "utf8",
);
assert.match(composeSource, /dockerfile: Dockerfile\.production/);
assert.match(composeSource, /dockerfile: Dockerfile\.migrate\.production/);
assert.match(
  rehearsalSource,
  /Remote rehearsal requires digest-pinned LEVI_IMAGE and LEVI_MIGRATION_IMAGE/,
);
assert.match(rehearsalSource, /compose --profile migration pull app migrate/);
assert.match(rehearsalSource, /LEVI_RUN_SYNTHETIC_WORKLOAD/);
assert.match(rehearsalSource, /LEVI_RUN_BACKUP_RESTORE/);
assert.match(
  rehearsalSource,
  /production-workload\.mjs:\/app\/production-workload\.mjs:ro/,
);
assert.match(workloadSource, /synthetic-two-church/);
assert.match(workloadSource, /tenantIsolation: "passed"/);
assert.equal(
  caddySource.match(/X-Robots-Tag "noindex, nofollow, noarchive"/g)?.length,
  2,
  "Both the canonical and www sites must prevent search indexing",
);
assert.match(rehearsalSource, /production-backup\.sh/);
assert.match(rehearsalSource, /production-restore\.sh/);
assert.match(rehearsalSource, /restored_sessions=0/);
const postgresStart = rehearsalSource.indexOf(
  "compose up --detach --wait postgres",
);
const migrationRun = rehearsalSource.indexOf(
  "compose --profile migration run --rm migrate",
);
const applicationStart = rehearsalSource.indexOf(
  "compose up --detach --wait app",
);
assert(postgresStart >= 0, "Rehearsal must start PostgreSQL");
assert(
  migrationRun > postgresStart,
  "Rehearsal must migrate after PostgreSQL is ready",
);
assert(
  applicationStart > migrationRun,
  "Rehearsal must start the application after migration",
);
const composeEnvironment = { ...process.env };
for (const variable of [
  "ACME_EMAIL",
  "ADMIN_BASIC_AUTH_PASSWORD_HASH",
  "ADMIN_BASIC_AUTH_USERNAME",
  "ADMIN_BETTER_AUTH_SECRET",
  "BETTER_AUTH_BASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "DATABASE_URL",
  "LEVI_APP_DATABASE_PASSWORD",
  "LEVI_DOMAIN",
  "LEVI_IMAGE",
  "LEVI_MIGRATION_IMAGE",
  "MIGRATION_DATABASE_URL",
  "MIGRATION_SHADOW_DATABASE_URL",
  "POSTGRES_DB",
  "POSTGRES_PASSWORD",
  "POSTGRES_USER",
  "MAIL_FROM",
  "SMTP_HOST",
  "SMTP_PASSWORD",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
]) {
  delete composeEnvironment[variable];
}

const result = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    exampleEnvironment,
    "-f",
    composeFile,
    "--profile",
    "migration",
    "config",
    "--format",
    "json",
  ],
  { cwd: repositoryRoot, encoding: "utf8", env: composeEnvironment },
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
assert.match(app.environment?.DATABASE_URL ?? "", /^postgresql:\/\/levi_app:/);
assert.equal(app.environment?.ADMIN_BASIC_AUTH_USERNAME, "levi-admin");
assert.equal(
  app.environment?.ADMIN_BETTER_AUTH_SECRET,
  "replace-with-a-distinct-32-character-random-secret",
);
assert.equal(
  app.environment?.ADMIN_BASIC_AUTH_PASSWORD_HASH,
  "replace-with-output-from-pnpm-admin-hash-password",
);
assert.equal(app.environment?.POSTGRES_PASSWORD, undefined);
assert.equal(app.environment?.MIGRATION_DATABASE_URL, undefined);
assert.equal(app.environment?.SMTP_HOST, "smtp.gmail.com");
assert.equal(app.environment?.SMTP_PORT, "587");
assert.equal(app.environment?.SMTP_SECURE, "false");
assert.equal(app.environment?.SMTP_USER, "levi.system.app@gmail.com");
assert.equal(app.environment?.MAIL_FROM, "levi.system.app@gmail.com");

const postgres = config.services.postgres!;
assert.equal(postgres.read_only, true);
assert(postgres.cap_drop?.includes("ALL"));
assert(postgres.healthcheck, "PostgreSQL must define a healthcheck");
assert.equal(postgres.ports, undefined, "PostgreSQL must not publish a port");
assert.deepEqual(Object.keys(postgres.networks ?? {}), ["private"]);
assert.equal(config.networks.private?.internal, true);
assert.equal(postgres.environment?.POSTGRES_USER, "levi_admin");
assert(postgres.environment?.LEVI_APP_DATABASE_PASSWORD);

const migrate = config.services.migrate!;
assert(migrate, "Missing migration service");
assert.equal(migrate.user, "1000:1000");
assert.equal(migrate.read_only, true);
assert(migrate.cap_drop?.includes("ALL"));
assert.match(
  migrate.environment?.DATABASE_URL ?? "",
  /^postgresql:\/\/levi_admin:/,
);
assert.match(
  migrate.environment?.SHADOW_DATABASE_URL ?? "",
  /\/levi_shadow\?schema=public$/,
);

const proxy = config.services.proxy!;
assert.equal(proxy.read_only, true);
assert(proxy.ports && proxy.ports.length === 3);
assert.equal(proxy.environment?.LEVI_DOMAIN, "levi-system.com");

console.log("Production Compose configuration passed security invariants.");
