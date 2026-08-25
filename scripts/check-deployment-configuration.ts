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
const deployEntrypoint = path.join(
  repositoryRoot,
  "scripts/production-deploy-entrypoint.sh",
);
const deployEntrypointInstaller = path.join(
  repositoryRoot,
  "scripts/install-production-deploy-entrypoint.sh",
);
const authorizedDeployScript = path.join(
  repositoryRoot,
  "scripts/run-authorized-production-deploy.sh",
);
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
  [
    "-n",
    deployScript,
    deployEntrypoint,
    deployEntrypointInstaller,
    authorizedDeployScript,
    healthScript,
    secretCheckScript,
    bibleImportScript,
  ],
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
assert.match(
  deployWorkflow,
  /production-deploy-authorization-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/,
);
assert.match(deployWorkflow, /retention-days: 1/);
assert.match(deployWorkflow, /actions\/upload-artifact@[a-f0-9]{40}/);
assert.doesNotMatch(deployWorkflow, /\bssh\b/);
assert.doesNotMatch(deployWorkflow, /PRODUCTION_SSH_/);
assert.doesNotMatch(deployWorkflow, /sudo git/);
assert.doesNotMatch(deployWorkflow, /sudo env/);

const authorizedDeploySource = readFileSync(authorizedDeployScript, "utf8");
assert.match(authorizedDeploySource, /\.conclusion.*success/s);
assert.match(authorizedDeploySource, /\.head_branch.*main/s);
assert.match(authorizedDeploySource, /deploy-production\.yml/);
assert.match(authorizedDeploySource, /gh run download/);
assert.match(authorizedDeploySource, /production-deploy-authorization/);
assert.match(authorizedDeploySource, /ssh -o BatchMode=yes/);
assert.match(
  authorizedDeploySource,
  /sudo -n \/usr\/local\/sbin\/levi-production-deploy/,
);
assert.doesNotMatch(authorizedDeploySource, /PRODUCTION_SSH_PRIVATE_KEY/);

const authorizationFixture = mkdtempSync(
  path.join(tmpdir(), "levi-deploy-authorization."),
);
try {
  const fakeGh = path.join(authorizationFixture, "gh");
  const fakeSsh = path.join(authorizationFixture, "ssh");
  const authorizationRecord = path.join(
    authorizationFixture,
    "authorization.json",
  );
  const sshCapture = path.join(authorizationFixture, "ssh-arguments.txt");
  const runId = 123456;
  const runAttempt = 2;

  writeFileSync(
    authorizationRecord,
    JSON.stringify({
      schema_version: 1,
      repository: "iwaseasahi/levi",
      run_id: runId,
      run_attempt: runAttempt,
      commit_sha: "a".repeat(40),
      application_image: `ghcr.io/iwaseasahi/levi@sha256:${"b".repeat(64)}`,
      migration_image: `ghcr.io/iwaseasahi/levi-migrate@sha256:${"c".repeat(64)}`,
      approval_comment:
        "https://github.com/iwaseasahi/levi/issues/292#issuecomment-123",
      authorized_at: "2026-08-25T00:00:00Z",
    }),
  );
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "api repos/iwaseasahi/levi/actions/runs/${runId}" ]]; then
  printf '{"event":"workflow_dispatch","status":"completed","conclusion":"%s","head_branch":"main","workflow_id":99,"run_attempt":${runAttempt}}\\n' "\${FAKE_RUN_CONCLUSION:-success}"
elif [[ "$1 $2" == "api repos/iwaseasahi/levi/actions/workflows/99" ]]; then
  printf '.github/workflows/deploy-production.yml\\n'
elif [[ "$1 $2" == "run download" ]]; then
  destination=""
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--dir" ]]; then destination="$2"; break; fi
    shift
  done
  cp "$AUTHORIZATION_FIXTURE" "$destination/production-deploy-authorization.json"
else
  exit 70
fi
`,
  );
  writeFileSync(
    fakeSsh,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" > "$SSH_CAPTURE"
`,
  );
  chmodSync(fakeGh, 0o755);
  chmodSync(fakeSsh, 0o755);

  const authorizationEnvironment = {
    ...process.env,
    PATH: `${authorizationFixture}:${process.env.PATH ?? ""}`,
    AUTHORIZATION_FIXTURE: authorizationRecord,
    SSH_CAPTURE: sshCapture,
  };
  const authorized = spawnSync("bash", [authorizedDeployScript, `${runId}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: authorizationEnvironment,
  });
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.match(readFileSync(sshCapture, "utf8"), /levi-system-production/);
  assert.match(
    readFileSync(sshCapture, "utf8"),
    /sudo -n \/usr\/local\/sbin\/levi-production-deploy/,
  );

  const rejected = spawnSync("bash", [authorizedDeployScript, `${runId}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...authorizationEnvironment,
      FAKE_RUN_CONCLUSION: "failure",
    },
  });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /did not succeed/);

  writeFileSync(
    authorizationRecord,
    JSON.stringify({
      schema_version: 1,
      repository: "iwaseasahi/levi",
      run_id: runId,
      run_attempt: runAttempt,
      commit_sha: "not-an-exact-commit",
      application_image: `ghcr.io/iwaseasahi/levi@sha256:${"b".repeat(64)}`,
      migration_image: `ghcr.io/iwaseasahi/levi-migrate@sha256:${"c".repeat(64)}`,
      approval_comment:
        "https://github.com/iwaseasahi/levi/issues/292#issuecomment-123",
      authorized_at: "2026-08-25T00:00:00Z",
    }),
  );
  const tampered = spawnSync("bash", [authorizedDeployScript, `${runId}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: authorizationEnvironment,
  });
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /authorization record is invalid/);
} finally {
  rmSync(authorizationFixture, { recursive: true, force: true });
}

const deployEntrypointSource = readFileSync(deployEntrypoint, "utf8");
assert.match(
  deployEntrypointSource,
  /expected_operator="levi-system-operator"/,
);
assert.match(deployEntrypointSource, /repository="\/opt\/levi"/);
assert.match(deployEntrypointSource, /\$#" -ne 4/);
assert.match(deployEntrypointSource, /merge-base --is-ancestor/);
assert.match(deployEntrypointSource, /exec \/usr\/bin\/env -i/);
assert.match(deployEntrypointSource, /production-deploy\.sh/);
assert.doesNotMatch(deployEntrypointSource, /LEVI_ALLOW_TEST_OVERRIDES/);

const deployEntrypointInstallerSource = readFileSync(
  deployEntrypointInstaller,
  "utf8",
);
assert.match(deployEntrypointInstallerSource, /visudo -cf/);
assert.match(
  deployEntrypointInstallerSource,
  /NOPASSWD: %s.*entrypoint_target/,
);
assert.match(deployEntrypointInstallerSource, /-m 0440/);
assert.doesNotMatch(
  deployEntrypointInstallerSource,
  /NOPASSWD:.*(?:git|env|docker|bash|sh\b)/,
);

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
