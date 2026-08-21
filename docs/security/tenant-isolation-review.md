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
