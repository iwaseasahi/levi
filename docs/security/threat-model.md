# Initial threat model

This model covers the Levi repository, browser application, PostgreSQL boundary,
CI, and the expected search/audience presentation topology. Revisit it for
every authentication, content import, file, external service, or deployment
decision.

## Assets and data

- Song, slide text/image, Bible, bookmark, and folder content and its licensing/provenance.
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
| Rich-text schema abuse                | Slide editor JSON, paste, and drag/drop                             | Application-owned versioned text/break allowlist, four size tokens, plain-text paste, React span rendering, no stored/rendered HTML                                                                                                    | Version review before adding any node or mark                                                 |
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
| Malicious image upload                | Slide multipart upload and decoder                                  | 10 MiB request/output limits, signature-based decode, static JPEG/PNG/WebP allowlist, 8,192-side/40M-pixel bounds, metadata stripping, two active/four queued normalizations, 30-second response timeout, generalized errors           | Native work retains its concurrency slot after timeout; monitor process memory and latency    |
| Unauthorized image disclosure         | Slide image byte route, browser cache, projection                   | Session-derived church scope, exact Slide revision, indistinguishable missing/foreign response, private no-store/nosniff response, no public URL or projection payload bytes, bounded audience revalidation                            | Already-rendered pixels persist until the bounded revalidation/browser lifecycle              |

## Review triggers

Update this model when a new data class, actor/role, public endpoint, upload,
external service, real-time channel, dependency execution path, deployment
target, or production recovery process is introduced. A mitigation is complete
only when linked to code/config and an executable check.

## Slide delivery review (#388)

[The Slide boundary matrix](tenant-isolation-review.md#slide-aggregate-audit-388)
covers every new read/write/search/preview/audience path. User input never chooses
a church scope; guessed/foreign UUIDs share a denial, and query cursors cannot
transfer scope. Real church/admin sessions, revocation, suspension, user deletion,
church cascade and revision conflicts have executable negative evidence.

Projection owns only saved data. Authentication/revision failures clear its page
array and permanently stop the document session; old in-flight responses cannot
restore it. v2 messages bind exact peer, kind, generation, challenge, document
instance and sequence, with no church content in transport. Literal text render,
no-store reads, bounded requests/results, fixed mutation log attributes and
recursive author/query/cursor redaction address injection/disclosure risks.
Revocation is bounded by navigation/visibility/30 seconds, not instantaneous.
Previously loaded management edit buffers are not remotely erased. Encrypted
archives may contain physically deleted Slides; #389 requires reviewed deletion
reconciliation before a separately approved restore promotion. No legacy Slide
import, content history, new service or expanded administrator access is added.

## Slide image review (#470)

Original filenames and claimed MIME types are untrusted and discarded. Sharp
must decode an allowed static format before any database write, then orientation
is applied and metadata is stripped through re-encoding. Request bytes, decoded
pixels, output bytes, active/queued work, and response time are bounded. A timed
out native operation is not treated as cancelled: it retains its normalization
slot until completion so repeated timeouts cannot silently exceed the active-work
limit.

Image bytes are Confidential and live only in `slide_images.data` and encrypted
database backups. Ordinary Slide selects name every returned field and include
only image dimensions/media type/size. Byte reads require the authenticated
image route for the server-derived church and exact current revision; URLs and
window messages carry no bytes, checksum, filename, or storage credential.
Mutation logs contain only fixed capability/status fields.

Church-row locking serializes quota-changing writes. Composite ownership FKs,
deferred content-type triggers, database bounds, and one transaction prevent
cross-tenant children, orphan bytes, quota races, and text/image partial state.
Physical deletion cascades, while encrypted backup retention remains the known
delayed-erasure boundary. The restore rehearsal hashes actual synthetic bytes
inside PostgreSQL without printing them. PostgreSQL/S3 migration conditions and
the accepted single-VPS durability risk are recorded in ADR 0016.
