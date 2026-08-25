import assert from "node:assert/strict";
import { isIP } from "node:net";
import { readFileSync } from "node:fs";
import { resolve4, resolve6, resolveCname, resolveNs } from "node:dns/promises";
import { connect, type PeerCertificate } from "node:tls";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parse } from "dotenv";

interface ProductionDomain {
  domain: string;
  canonicalOrigin: string;
  wwwOrigin: string;
  dnsProvider: string;
  nameServers: string[];
  ipv6Enabled: boolean;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const productionDirectory = path.join(repositoryRoot, "deploy", "production");
const target = JSON.parse(
  readFileSync(path.join(productionDirectory, "domain.json"), "utf8"),
) as ProductionDomain;
const productionEnvironment = parse(
  readFileSync(
    path.join(productionDirectory, "production.env.example"),
    "utf8",
  ),
);
const monitoringEnvironment = parse(
  readFileSync(
    path.join(productionDirectory, "monitoring.env.example"),
    "utf8",
  ),
);
const caddyfile = readFileSync(
  path.join(productionDirectory, "Caddyfile"),
  "utf8",
);
const smokeWorkflow = readFileSync(
  path.join(repositoryRoot, ".github", "workflows", "production-smoke.yml"),
  "utf8",
);

function normalizeDnsName(value: string) {
  return value.toLowerCase().replace(/\.$/, "");
}

function assertConfiguration() {
  assert.equal(target.domain, "levi-system.com");
  assert.equal(target.canonicalOrigin, `https://${target.domain}`);
  assert.equal(target.wwwOrigin, `https://www.${target.domain}`);
  assert.equal(target.dnsProvider, "XServer Domain");
  assert.deepEqual(target.nameServers, [
    "ns1.xdomain.ne.jp",
    "ns2.xdomain.ne.jp",
    "ns3.xdomain.ne.jp",
  ]);
  assert.equal(target.ipv6Enabled, false);

  assert.equal(productionEnvironment.LEVI_DOMAIN, target.domain);
  assert.equal(
    productionEnvironment.BETTER_AUTH_BASE_URL,
    target.canonicalOrigin,
  );
  assert.equal(
    productionEnvironment.BETTER_AUTH_TRUSTED_ORIGINS,
    target.canonicalOrigin,
  );
  assert.equal(
    monitoringEnvironment.LEVI_PRODUCTION_BASE_URL,
    target.canonicalOrigin,
  );

  assert.match(caddyfile, /^\{\$LEVI_DOMAIN\} \{/m);
  assert.match(caddyfile, /^www\.\{\$LEVI_DOMAIN\} \{/m);
  assert.match(caddyfile, /redir https:\/\/\{\$LEVI_DOMAIN\}\{uri\} 308/);
  assert.match(
    smokeWorkflow,
    /PRODUCTION_BASE_URL" == "https:\/\/levi-system\.com"/,
  );
}

function isNoDataError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENODATA" || error.code === "ENOTFOUND")
  );
}

async function assertNoIpv6Record() {
  try {
    const records = await resolve6(target.domain);
    if (records.length > 0) {
      throw new Error("The production apex must not publish an AAAA record.");
    }
  } catch (error) {
    if (!isNoDataError(error)) throw error;
  }
}

function assertSameSet(actual: string[], expected: string[], message: string) {
  const normalizedActual = actual.map(normalizeDnsName).sort();
  const normalizedExpected = expected.map(normalizeDnsName).sort();
  if (
    normalizedActual.length !== normalizedExpected.length ||
    normalizedActual.some((value, index) => value !== normalizedExpected[index])
  ) {
    throw new Error(message);
  }
}

async function assertRedirect(source: string, expectedLocation: string) {
  const response = await fetch(source, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 308) {
    throw new Error(`${source} must return an HTTP 308 redirect.`);
  }
  if (response.headers.get("location") !== expectedLocation) {
    throw new Error(
      `${source} must preserve its path and query when redirecting.`,
    );
  }
}

function readCertificate(hostname: string): Promise<PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = connect(
      {
        host: hostname,
        port: 443,
        rejectUnauthorized: true,
        servername: hostname,
        timeout: 10_000,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        socket.end();
        resolve(certificate);
      },
    );
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${hostname} timed out.`));
    });
  });
}

async function assertCertificate(hostname: string) {
  const certificate = await readCertificate(hostname);
  const validUntil = Date.parse(certificate.valid_to);
  if (!Number.isFinite(validUntil)) {
    throw new Error(`${hostname} did not return a parseable TLS certificate.`);
  }
  if (validUntil - Date.now() < 30 * 24 * 60 * 60 * 1_000) {
    throw new Error(
      `${hostname} TLS certificate expires in less than 30 days.`,
    );
  }
}

async function assertLiveConfiguration() {
  const expectedIpv4 = process.env.LEVI_EXPECTED_IPV4?.trim() ?? "";
  if (isIP(expectedIpv4) !== 4) {
    throw new Error(
      "Set LEVI_EXPECTED_IPV4 to the approved WebARENA production IPv4 before live verification.",
    );
  }

  const apexAddresses = await resolve4(target.domain);
  assertSameSet(
    apexAddresses,
    [expectedIpv4],
    "The production apex A record does not exactly match the approved IPv4.",
  );
  await assertNoIpv6Record();
  assertSameSet(
    await resolveCname(`www.${target.domain}`),
    [target.domain],
    "The www CNAME does not point exactly to the production apex.",
  );
  assertSameSet(
    await resolveNs(target.domain),
    target.nameServers,
    "The domain is not delegated to the expected XServer Domain name servers.",
  );

  const checkPath = "/__levi-domain-check?source=www";
  await assertRedirect(
    `http://${target.domain}${checkPath}`,
    `${target.canonicalOrigin}${checkPath}`,
  );
  await assertRedirect(
    `${target.wwwOrigin}${checkPath}`,
    `${target.canonicalOrigin}${checkPath}`,
  );

  const readiness = await fetch(`${target.canonicalOrigin}/api/ready`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!readiness.ok) {
    throw new Error("The production readiness endpoint is not successful.");
  }
  const readinessBody = (await readiness.json()) as { status?: unknown };
  if (readinessBody.status !== "ready") {
    throw new Error("The production readiness endpoint is not ready.");
  }

  await assertCertificate(target.domain);
  await assertCertificate(`www.${target.domain}`);
}

assertConfiguration();

if (process.argv.includes("--live")) {
  await assertLiveConfiguration();
  console.log("Production domain live verification passed.");
} else {
  console.log("Production domain configuration passed pre-purchase checks.");
}
