# XServer Domain DNS and TLS cutover

## Scope and safety boundary

This runbook prepares `levi-system.com` for the WebARENA Indigo production VPS.
The repository is already configured for the final domain, so purchasing the
domain must not require an application code change.

Domain purchase, account security changes, DNS record changes, first public TLS
issuance, GitHub production settings, and opening production traffic are
external production actions. The Levi operator performs them only with the
specific approval required by
[`autonomy.md`](../governance/autonomy.md#actions-that-always-require-human-approval).
Do not put the VPS IP address, credentials, recovery codes, or account details
in an Issue, pull request, command transcript, or repository file.

The selected non-secret target is
[`domain.json`](../../deploy/production/domain.json):

- canonical origin: `https://levi-system.com`;
- `www` origin: permanent redirect to the canonical origin;
- DNS provider: XServer Domain;
- initial DNS: one apex A record and one `www` CNAME;
- no initial AAAA, wildcard, or mail records.

XServer's official DNS manual states that an A record contains an IPv4 address,
a CNAME contains a hostname, and its default name servers are
`ns1.xdomain.ne.jp`, `ns2.xdomain.ne.jp`, and `ns3.xdomain.ne.jp`:
<https://www.xdomain.ne.jp/manual/man_domain_dns_setting.php>.
Caddy obtains and renews publicly trusted certificates after DNS resolves to the
server and ports 80/443 are reachable:
<https://caddyserver.com/docs/automatic-https>.

## Work that is safe before purchase

From a clean checkout, run the network-independent checks:

```bash
mise exec -- pnpm production:domain:check
mise exec -- pnpm production:config:check
```

They confirm that:

- `LEVI_DOMAIN`, Better Auth, monitoring, and the external smoke workflow all
  use the exact apex origin;
- Caddy serves the apex and permanently redirects `www`, preserving path and
  query;
- production Compose passes its security invariants.

Do not set the GitHub `PRODUCTION_BASE_URL` variable yet. The scheduled smoke
workflow starts running as soon as the variable exists and would report expected
failures while the domain is unavailable.

## Human purchase checklist

Immediately before purchase, the operator verifies availability and the final
initial and renewal prices in the XServer checkout. During or immediately after
purchase:

1. register the domain to the Levi operator's current legal contact details;
2. enable two-factor authentication and store recovery material outside GitHub,
   the repository, and the VPS;
3. enable automatic renewal and verify the billing-failure notification route;
4. enable Whois proxy publication, registrar lock, and domain protection where
   offered;
5. confirm delegation to the three name servers recorded in `domain.json`.

Do not configure XServer hosting SSL. TLS terminates at Caddy on WebARENA.

## Pre-DNS production gate

Before publishing DNS, complete and record these checks without exposing secret
values:

1. the approved WebARENA production IPv4 is known out of band;
2. UFW and the WebARENA security group allow TCP 80/443 and UDP 443;
3. `/etc/levi/production.env` contains the exact values below in addition to its
   protected secrets:

   ```dotenv
   LEVI_DOMAIN=levi-system.com
   BETTER_AUTH_BASE_URL=https://levi-system.com
   BETTER_AUTH_TRUSTED_ORIGINS=https://levi-system.com
   ```

4. `/etc/levi/monitoring.env` contains:

   ```dotenv
   LEVI_PRODUCTION_BASE_URL=https://levi-system.com
   ```

5. application and database readiness pass on the private Compose network;
6. the Caddy ACME contact is a monitored address and the Caddy data volume is
   persistent;
7. the deploy commit, image digests, migration impact, backup, rollback, and
   timing have immediate human approval.

Do not repeatedly restart Caddy while DNS or ports are wrong. Fix the failed
precondition first to avoid unnecessary ACME attempts.

## DNS change

In XServer Domain's DNS record screen, add only these application records. The
operator obtains the IPv4 out of band and never copies it into GitHub.

| Host         | Type  | Content                           | TTL  |
| ------------ | ----- | --------------------------------- | ---- |
| empty (apex) | A     | approved WebARENA production IPv4 | 3600 |
| `www`        | CNAME | `levi-system.com`                 | 3600 |

Remove or replace conflicting default A, AAAA, or CNAME records for these exact
hosts only after confirming their targets. Do not add an AAAA record until IPv6
firewall and external reachability have their own approved test. Do not add
wildcard, MX, SPF, DKIM, or DMARC records for the initial release.

Wait for the authoritative XServer name servers to return the intended records
before interpreting public resolver results. DNS caches can continue returning
older values until their TTL expires.

## Start Caddy and verify

Start or deploy the approved production Compose release using
[`manual-production-deploy.md`](manual-production-deploy.md). Caddy requests
certificates for both apex and `www` and stores them in its persistent data
volume.

From an operator checkout, pass the approved IP only through the process
environment and run the opt-in live check:

```bash
LEVI_EXPECTED_IPV4='<approved WebARENA IPv4>' \
  mise exec -- pnpm production:domain:verify
```

The command fails unless all of the following are true:

- apex A exactly matches the approved IPv4;
- no apex AAAA exists;
- `www` is exactly a CNAME to the apex;
- delegation uses the expected XServer name servers;
- apex HTTP redirects to apex HTTPS with HTTP 308;
- `www` HTTPS redirects to apex HTTPS with HTTP 308 while preserving path and
  query;
- `https://levi-system.com/api/ready` returns `{"status":"ready"}`;
- both TLS hostnames validate through the system trust store and their
  certificates have at least 30 days remaining.

Then restart only the Caddy container once and run the live check again. This
proves the persisted certificate is reusable. Inspect Caddy logs for certificate
renewal errors without copying request IPs or other sensitive log fields into an
Issue.

Only after the live check passes, set the GitHub repository variable exactly to:

```text
PRODUCTION_BASE_URL=https://levi-system.com
```

Run `Production smoke` manually once and confirm `External readiness` passes
before relying on its 15-minute schedule.

## Failure and rollback

- If authoritative DNS is wrong, correct only the affected apex A or `www`
  CNAME. Do not keep retrying Caddy until the authoritative answer is correct.
- If certificates fail, verify DNS, TCP 80/443 reachability, system time, and
  Caddy logs. Preserve the Caddy data volume and wait for the reported retry
  interval rather than deleting certificate state.
- If application readiness fails, stop the public proxy or restore the previous
  approved application digest according to the deploy runbook. Do not point DNS
  at an unverified substitute host.
- If the public launch must be withdrawn, obtain immediate approval and remove
  only the two application records. Keep the domain registration, account
  protection, and Caddy evidence intact for recovery.

Record timestamps, pass/fail outcomes, approved commit and digests, and the
approval reference. Record neither the IP value nor credentials.
