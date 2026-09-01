# Church tenant isolation review

This checklist is required whenever a new church-owned aggregate, route, server
action, use case, repository method, log attribute, or browser workflow is
introduced. ADR 0007 and the data-model dictionary remain authoritative.

## Trust boundary

- [x] Better Auth validates the session before Levi resolves membership.
- [x] `resolveChurchAccess` is the only application constructor of branded
      `ChurchScope`.
- [x] Pending identities, suspended churches, stale/revoked sessions, and
      platform operators cannot obtain Church scope.
- [x] Browser-provided `churchId` is rejected and never selects authorization
      context.

## Application and persistence

- [x] Every Folder/Bookmark use-case and repository method requires
      `ChurchScope`, not a raw UUID.
- [x] Read, update, delete, reorder, and owner-lock queries include `church_id`.
- [x] Bookmark-to-Folder composite ownership is independently enforced by
      PostgreSQL.
- [x] Complete-set reorder rejects foreign, guessed, duplicate, and stale IDs
      without partial writes.
- [x] Physical delete remains inside the selected aggregate; Bible masters are
      restricted.

## Disclosure and observable behavior

- [x] Foreign and nonexistent resource IDs return the same status, body, and
      cache policy through the same scoped repository lookup.
- [x] Error DTOs contain stable codes only and omit names, IDs, SQL, and stack
      details.
- [x] Structured logging recursively redacts credentials, sessions, email,
      church-created names/content, and request query/params.
- [x] E2E fixtures are synthetic and traces/screenshots contain no production or
      confidential tenant content.

## Executable evidence

- `src/application/auth/church-access.test.ts`
- `tests/integration/auth-session.test.ts`
- `tests/integration/tenant-isolation.test.ts`
- `tests/integration/saved-content.test.ts`
- `tests/e2e/scripture-search.spec.ts` (foreign and guessed folder denial)
- `src/infrastructure/observability/logger.test.ts`

Future aggregates must add their own allowed/foreign/guessed/mixed/stale cases
before this checklist remains satisfied.

## Slide aggregate audit (#388)

The reviewed implementation is church-owned (ADR 0015). No platform-administrator
capability grants church membership. Scope is derived for every request; a cursor
is only a query-bound position and is never an authorization token.

| Boundary                                               | Enforcement and executable evidence                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create, detail, update, physical delete                | Strict fields reject `churchId`; real session resolver + branded scope; every lookup/row lock uses church ID. Foreign/missing GET/PUT/DELETE have identical 404 body/cache. `slide-crud.test.ts`, `slide-api.spec.ts`, `slide-security.spec.ts`.                                                                             |
| Creation-order list and cursor reuse                   | Parameterized church-scoped SQL; bounded metadata-only results; removed query modes and forged cursor fields rejected. `slide-list.test.ts`, `slide-list.spec.ts`, `slide-security.spec.ts`.                                                                                                                                 |
| Preview and edit route                                 | Preview parses unsaved local body, sends no request and changes no audience. Editor is page-gated; foreign detail/edit never receive a Slide. `slide-editor.component.test.tsx`, `slide-editor.spec.ts`, `slide-security.spec.ts`.                                                                                           |
| Admin-only, suspended, revoked, forced password change | Actual Better Auth database sessions tested through every read/mutation handler. No data modification on denial. `slide-authorization.test.ts`; real browser suspended/revoked audience in `slide-security.spec.ts`.                                                                                                         |
| User deletion / church cascade                         | User deletion preserves the exact Slide row, including revision/timestamps. Church deletion removes its Slide and preserves other tenants/shared Bible. `delete-church-user.test.ts`, `delete-church.test.ts`, `slide-schema.test.ts`.                                                                                       |
| Concurrent update/delete                               | Expected revision enforced under scoped transactional row lock; stale delete 409, only one racing writer succeeds. `slide-crud.test.ts`.                                                                                                                                                                                     |
| Audience and cached/late state                         | Saved GET with no-store on navigation/visibility/30-second cycle; failure terminally clears pages, including late concurrent reads. Generic audience errors contain no login/account UI. `project-slide.test.ts`, `slide-projection.component.test.tsx`, projection/security E2E.                                            |
| Cross-window trust                                     | Strict v2 schema, origin + exact Window, content kind/generation, challenge/document instance and monotonic sequences; no body in messages. `transport.test.ts`, `transport.component.test.tsx`, `projection-connection.spec.ts`.                                                                                            |
| HTML/log/URL/storage disclosure                        | React literal `pre`; no raw HTML. Audience URL is ID/page plus nonce only. APIs no-store; logger allowlist and recursive sensitive-key redaction explicitly cover author/cursor as well as title/body/query. `slide-projection.spec.ts`, `logger.test.ts`; source inspection found no Slide localStorage or content logging. |

All fixtures are synthetic; no production/dump access. Immediate remote revocation
between checks is not claimed. Management tabs can retain an already loaded edit
buffer, but every subsequent API operation reauthorizes; they cannot turn it into
a saved/projection update without authorization. Recovery/deletion replay is
separately covered by #389. Issue #397 removes the unused substring-search path;
final cross-flow acceptance and parity evidence are owned by #390.
