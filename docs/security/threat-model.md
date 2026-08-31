# Initial threat model

This model covers the Levi repository, browser application, PostgreSQL boundary,
CI, and the expected search/audience presentation topology. Revisit it for
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
        ├── authenticated direct audience tab/display
        └── approved file/error-monitoring services (not connected yet)

GitHub contributor/agent ── protected PR + pinned CI ── main
exact candidate ── automated validation (+ Sunday human approval) ── operator deploy
```

The browser, imported files/content, legacy exports, dependency packages, pull
requests, and CI artifacts are untrusted inputs. Database access is restricted to
the infrastructure layer. Production credentials and data are outside the normal
agent/development boundary.

## Threats and mitigations

| Threat                                | Asset/entry point                                                   | Initial mitigation and evidence                                                                                                                                                                                                        | Residual/follow-up                                                                            |
| ------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Identity spoofing/session theft       | Login, email setup/reset, DB session, cookies, search/audience tabs | Better Auth `scrypt`, single-use 72-hour setup/reset links, host-only secure cookies, hashed session tokens, DB revocation, 30-day expiry, no cookie cache, auth tests                                                                 | Raw session cookies remain Restricted; harden DB/backups and patch latest Better Auth         |
| Privilege escalation/IDOR             | Platform routes and every church-owned lookup                       | Better Auth proves identity only; Levi derives a branded `ChurchScope` from active membership, requires it in church-owned application/repository APIs, scopes every query, and returns identical denials for guessed/cross-tenant IDs | Negative integration and latest-Chrome matrices are maintained with each new church aggregate |
| Injection/XSS                         | Search, song/slide text, route params, imported content             | Typed validation at boundary, React escaping, parameterized Prisma queries, CSP before rich content                                                                                                                                    | Add adversarial fixtures per input type                                                       |
| CSRF/replay                           | Auth endpoints, browser mutations, presentation control             | Better Auth exact trusted origins and Fetch Metadata/origin checks; SameSite cookie; disabling checks is forbidden; domain mutations use idempotency/version guards                                                                    | Issue #51 decides the presentation message protocol                                           |
| Data tampering/loss                   | DB, migrations, backup, migration import                            | PostgreSQL constraints/transactions, protected migrations, drift checks, backup restore rehearsal, reconciliation                                                                                                                      | ADR 0005 accepts on-host logical recovery only; VPS/disk loss has no recovery objective       |
| Sensitive data disclosure             | Logs, errors, fixtures, CI artifacts, backups                       | Data classification, stable non-disclosing error DTOs, recursive credential/email/content/query redaction, synthetic tenant fixtures, and short artifact retention                                                                     | External monitoring processor review required                                                 |
| Supply-chain compromise               | pnpm packages and GitHub Actions                                    | Frozen lockfile, high-severity audit, reviewed license set, Dependabot, pinned action SHAs, protected CI                                                                                                                               | Add provenance/signature policy as ecosystem support matures                                  |
| Secret exposure                       | Git history, PR, artifact, agent prompt                             | Gitleaks, ignored env files, secret store only, credential boundary; rotation incident runbook                                                                                                                                         | Organization-level secret protection not configured here                                      |
| Denial of service/resource exhaustion | Login, email reset, search, rendering, DB pool                      | PostgreSQL-backed login/reset limits, generic reset response, bounded inputs/timeouts, health/readiness separation, DB pool, query/index review                                                                                        | Issues #85/#89 must prove Caddy trust boundary and 4 GB single-VPS capacity                   |
| Setup/reset token disclosure          | Invitation and password-recovery email links                        | Generate server-side, store only Better Auth verification state, expire after 72 hours, make links single-use, never log tokens, and revoke sessions after successful reset                                                            | Recipient mailbox security and Gmail delivery remain external dependencies                    |
| Request/log forgery                   | `x-request-id`, log attributes                                      | Levi replaces caller IDs with UUIDs and emits JSON; sensitive keys redact recursively                                                                                                                                                  | Issue #85 must define and test the Caddy-to-Levi trusted proxy boundary                       |
| Audience stale or unauthorized text   | Direct audience tab, cross-window controls, and authenticated APIs  | Canonical coordinates only in URL, strict versioned same-origin/exact-window messages, periodic/visibility session checks, fail-closed text removal and control rejection, direct-tab E2E                                              | Same-session latest-Chrome scope is retained                                                  |
| CI permission abuse                   | Agent/dependency PR                                                 | Read-only CI permissions, protected required checks, pinned actions, no production secrets/deploy job                                                                                                                                  | Separate release workflow/environment later                                                   |

## Review triggers

Update this model when a new data class, actor/role, public endpoint, upload,
external service, real-time channel, dependency execution path, deployment
target, or production recovery process is introduced. A mitigation is complete
only when linked to code/config and an executable check.
