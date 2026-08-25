import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const deployScript = path.join(repositoryRoot, "scripts/production-deploy.sh");
const healthScript = path.join(
  repositoryRoot,
  "scripts/check-production-health.sh",
);
const secretCheckScript = path.join(
  repositoryRoot,
  "scripts/check-production-secrets.sh",
);
const bibleImportScript = path.join(
  repositoryRoot,
  "scripts/production-bible-import.sh",
);
const domainScript = path.join(
  repositoryRoot,
  "scripts/check-production-domain.ts",
);
const currentCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).stdout.trim();
const digest = `sha256:${"a".repeat(64)}`;
const baseEnvironment = {
  ...process.env,
  LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
  LEVI_ALLOW_TEST_OVERRIDES: "true",
  LEVI_DEPLOY_APPROVAL_REFERENCE:
    "https://github.com/iwaseasahi/levi/issues/87#issuecomment-123",
  LEVI_DEPLOY_COMMIT: currentCommit,
  LEVI_DEPLOY_DRY_RUN: "true",
  LEVI_DEPLOY_REPOSITORY: repositoryRoot,
  LEVI_IMAGE: `ghcr.io/iwaseasahi/levi@${digest}`,
  LEVI_MIGRATION_IMAGE: `ghcr.io/iwaseasahi/levi-migrate@${digest}`,
};

const syntax = spawnSync(
  "bash",
  ["-n", deployScript, healthScript, secretCheckScript, bibleImportScript],
  { encoding: "utf8" },
);
assert.equal(syntax.status, 0, syntax.stderr);
assert.match(readFileSync(domainScript, "utf8"), /--live/);

const weekday = spawnSync("bash", [deployScript], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "5" },
});
assert.equal(weekday.status, 0, weekday.stderr);

const sunday = spawnSync("bash", [deployScript], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...baseEnvironment, LEVI_DEPLOY_WEEKDAY_OVERRIDE: "7" },
});
assert.notEqual(sunday.status, 0);
assert.match(sunday.stderr, /frozen on Sunday/);

const deployWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/deploy-production.yml"),
  "utf8",
);
for (const checkName of ["Quality", "Database", "E2E", "Security"]) {
  assert.match(
    deployWorkflow,
    new RegExp(`for required in.*${checkName}`, "s"),
  );
}
assert.match(deployWorkflow, /environment: production/);
assert.match(deployWorkflow, /workflow_dispatch:/);
assert.doesNotMatch(deployWorkflow, /^\s+push:/m);

const smokeWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/production-smoke.yml"),
  "utf8",
);
assert.match(
  smokeWorkflow,
  /PRODUCTION_BASE_URL" == "https:\/\/levi-system\.com"/,
);

const healthSource = readFileSync(healthScript, "utf8");
for (const signal of [
  "/api/ready",
  "pg_isready",
  "check-production-backups.sh",
  "df -Pk /",
  "free -m",
  "five_xx_count",
]) {
  assert(healthSource.includes(signal), `Missing health signal: ${signal}`);
}

const secretCheckSource = readFileSync(secretCheckScript, "utf8");
assert.match(
  secretCheckSource,
  /Production secret configuration passed without disclosing values/,
);
assert.match(secretCheckSource, /postgres_password.*!=.*app_password/s);
assert.match(secretCheckSource, /ADMIN_BASIC_AUTH_PASSWORD_HASH/);
assert.match(secretCheckSource, /PRIVATE KEY/);
assert.match(secretCheckSource, /config --quiet/);
assert.doesNotMatch(secretCheckSource, /set -x/);

const bibleImportSource = readFileSync(bibleImportScript, "utf8");
assert.match(bibleImportSource, /LEVI_IMPORT_APPROVAL_REFERENCE/);
assert.match(bibleImportSource, /LEVI_IMPORT_SOURCE_SHA/);
assert.match(bibleImportSource, /frozen on Sunday/);
assert.match(bibleImportSource, /\/var\/lib\/levi-import/);
assert.match(bibleImportSource, /ginmaku\.sql:ro/);
assert.match(bibleImportSource, /production-backup\.sh/);
assert.match(bibleImportSource, /run-production-database-bootstrap\.sh/);
assert.match(bibleImportSource, /\.status == "unchanged"/);
assert.match(bibleImportSource, /\.exact == true/);
assert.doesNotMatch(bibleImportSource, /set -x/);

const migrationDockerfile = readFileSync(
  path.join(repositoryRoot, "Dockerfile.migrate.production"),
  "utf8",
);
assert.match(migrationDockerfile, /scripts\/import-ginmaku-bible\.ts/);
assert.match(
  migrationDockerfile,
  /scripts\/run-production-database-bootstrap\.sh/,
);
assert.match(migrationDockerfile, /scripts\/run-production-bible-import\.sh/);
assert.match(migrationDockerfile, /pnpm db:generate/);

const bibleRehearsalSource = readFileSync(
  path.join(repositoryRoot, "scripts/rehearse-ginmaku-bible.ts"),
  "utf8",
);
assert.match(bibleRehearsalSource, /compose\.development\.yaml/);

const secretFixture = mkdtempSync(path.join(tmpdir(), "levi-secret-check."));
try {
  const productionEnvironment = path.join(secretFixture, "production.env");
  const backupEnvironment = path.join(secretFixture, "backup.env");
  const monitoringEnvironment = path.join(secretFixture, "monitoring.env");
  const certificate = path.join(secretFixture, "recipient.crt");
  const privateKey = path.join(secretFixture, "recipient.key");
  const fakeDocker = path.join(secretFixture, "docker");
  const adminPassword = "a".repeat(64);
  const appPassword = "b".repeat(64);
  const imageDigest = "c".repeat(64);
  const migrationDigest = "d".repeat(64);

  writeFileSync(
    productionEnvironment,
    [
      "LEVI_DOMAIN=levi-system.com",
      "ACME_EMAIL=operator@levi-system.com",
      `LEVI_IMAGE=ghcr.io/iwaseasahi/levi@sha256:${imageDigest}`,
      `LEVI_MIGRATION_IMAGE=ghcr.io/iwaseasahi/levi-migrate@sha256:${migrationDigest}`,
      "NODE_ENV=production",
      `DATABASE_URL=postgresql://levi_app:${appPassword}@postgres:5432/levi?schema=public`,
      `MIGRATION_DATABASE_URL=postgresql://levi_admin:${adminPassword}@postgres:5432/levi?schema=public`,
      `MIGRATION_SHADOW_DATABASE_URL=postgresql://levi_admin:${adminPassword}@postgres:5432/levi_shadow?schema=public`,
      `BETTER_AUTH_SECRET=${"e".repeat(64)}`,
      "BETTER_AUTH_BASE_URL=https://levi-system.com",
      "BETTER_AUTH_TRUSTED_ORIGINS=https://levi-system.com",
      "ADMIN_BASIC_AUTH_USERNAME=levi-admin",
      `ADMIN_BASIC_AUTH_PASSWORD_HASH=${"f".repeat(32)}:${"0".repeat(128)}`,
      "POSTGRES_DB=levi",
      "POSTGRES_USER=levi_admin",
      `POSTGRES_PASSWORD=${adminPassword}`,
      `LEVI_APP_DATABASE_PASSWORD=${appPassword}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  writeFileSync(
    backupEnvironment,
    `LEVI_ENV_FILE=${productionEnvironment}\nLEVI_BACKUP_CERTIFICATE=${certificate}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    monitoringEnvironment,
    `LEVI_ENV_FILE=${productionEnvironment}\n`,
    { mode: 0o600 },
  );
  writeFileSync(fakeDocker, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o700 });
  const certificateResult = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "60",
      "-subj",
      "/CN=Levi configuration test",
      "-keyout",
      privateKey,
      "-out",
      certificate,
    ],
    { encoding: "utf8" },
  );
  assert.equal(certificateResult.status, 0, certificateResult.stderr);
  chmodSync(certificate, 0o644);

  const secretValidation = spawnSync("bash", [secretCheckScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL: "true",
      LEVI_BACKUP_CERTIFICATE: certificate,
      LEVI_BACKUP_ENV_FILE: backupEnvironment,
      LEVI_COMPOSE_FILE: path.join(
        repositoryRoot,
        "deploy/production/compose.yaml",
      ),
      LEVI_MONITORING_ENV_FILE: monitoringEnvironment,
      LEVI_PRODUCTION_ENV_FILE: productionEnvironment,
      PATH: `${secretFixture}:${process.env.PATH ?? ""}`,
    },
  });
  assert.equal(secretValidation.status, 0, secretValidation.stderr);
  assert.equal(
    secretValidation.stdout,
    "Production secret configuration passed without disclosing values.\n",
  );
} finally {
  rmSync(secretFixture, { force: true, recursive: true });
}

console.log("Production deployment configuration passed safety invariants.");
