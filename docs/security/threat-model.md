# Initial threat model

This model covers the Levi repository, browser application, PostgreSQL boundary,
CI, and the expected controller/audience presentation topology. Revisit it for
every authentication, content import, file, external service, or deployment
decision.

## Assets and data

- Song, slide, Bible, bookmark, and folder content and its licensing/provenance.
- User/operator identity, roles, sessions, and future audit records.
- Database integrity, migration history, backups, and legacy-ID mappings.
- Presentation availability and correctness during a worship service.
- Source code, dependency graph, CI artifacts, credentials, and release history.

Classification and handling rules are in
[`data-classification.md`](data-classification.md).

## Trust boundaries

```text
untrusted browser/input
        │ HTTPS + authentication/authorization
        ▼
Next.js process ── validated DB protocol ── PostgreSQL
        │
        ├── controlled audience window/display (future design)
        └── approved file/error-monitoring services (not connected yet)

GitHub contributor/agent ── protected PR + pinned CI ── main
production credentials ── protected environment + human approval ── deploy job
```

The browser, imported files/content, legacy exports, dependency packages, pull
requests, and CI artifacts are untrusted inputs. Database access is restricted to
the infrastructure layer. Production credentials and data are outside the normal
agent/development boundary.

## Threats and mitigations

| Threat                                | Asset/entry point                                       | Initial mitigation and evidence                                                                                         | Residual/follow-up                                           |
| ------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Identity spoofing/session theft       | Login, cookies, controller/audience channel             | Auth selection gate; secure session design; authentication tests; never log authorization/cookies                       | Select provider and session topology in ADR 0004             |
| Privilege escalation/IDOR             | Every mutation and record lookup                        | Deny-by-default authorization independent of authentication; allowed/denied integration/E2E cases                       | Define roles/actions with first product slice                |
| Injection/XSS                         | Search, song/slide text, route params, imported content | Typed validation at boundary, React escaping, parameterized Prisma queries, CSP before rich content                     | Add adversarial fixtures per input type                      |
| CSRF/replay                           | Browser mutations and presentation control              | Same-site secure session, origin/CSRF protection, idempotency/version checks for consequential mutations                | Decide real-time control protocol                            |
| Data tampering/loss                   | DB, migrations, backup, migration import                | PostgreSQL constraints/transactions, protected migrations, drift checks, backup restore rehearsal, reconciliation       | Production backup provider and RPO/RTO undecided             |
| Sensitive data disclosure             | Logs, errors, fixtures, CI artifacts, backups           | Data classification, structured allowlisted logs, recursive key redaction, synthetic fixtures, short artifact retention | External monitoring processor review required                |
| Supply-chain compromise               | pnpm packages and GitHub Actions                        | Frozen lockfile, high-severity audit, reviewed license set, Dependabot, pinned action SHAs, protected CI                | Add provenance/signature policy as ecosystem support matures |
| Secret exposure                       | Git history, PR, artifact, agent prompt                 | Gitleaks, ignored env files, secret store only, credential boundary; rotation incident runbook                          | Organization-level secret protection not configured here     |
| Denial of service/resource exhaustion | Public endpoints, search, rendering, DB pool            | Bounded inputs/timeouts, health/readiness separation, DB pool, query/index review                                       | Rate limits and capacity targets await deployment decision   |
| Request/log forgery                   | `x-request-id`, log attributes                          | Levi replaces caller IDs with UUIDs and emits JSON; sensitive keys redact recursively                                   | Trust proxy forwarding only after deployment design          |
| Audience/controller desynchronization | Popup/display protocol                                  | Planned parity E2E, state versioning/reconnect behavior, no secrets in audience URL                                     | Product/display topology blocker in parity matrix            |
| CI permission abuse                   | Agent/dependency PR                                     | Read-only CI permissions, protected required checks, pinned actions, no production secrets/deploy job                   | Separate release workflow/environment later                  |

## Review triggers

Update this model when a new data class, actor/role, public endpoint, upload,
external service, real-time channel, dependency execution path, deployment
target, or production recovery process is introduced. A mitigation is complete
only when linked to code/config and an executable check.
