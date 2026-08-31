# Audit every Slide tenant and projection boundary

Issue #388 / parent #59. Dependencies #384/#385/#387 merged. Branch
`codex/issue-388`, base `f1f6d21`; writer lease acquired before edits.
Read governance, Slide contract/ADR 0015, testing and current tenant/threat review.

## Plan

1. [ ] Inventory two-church CRUD/search/cursor, local preview and audience paths.
2. [ ] Add real-auth integration coverage (admin-only, suspended/revoked), user
       deletion preservation, adversarial HTTP and audience invalidation E2E.
3. [ ] Harden recursive author/cursor log redaction; preserve metadata-only messages.
4. [ ] Update security matrix, run check/integration/E2E/security, separate review,
       exact-head required CI and merge.

## Constraints

Synthetic data only. No authorization widening, history, schema, dependency or
production operation. Existing domain/component tests cover late responses and
wrong-origin/source/kind/generation/sequence. New audit complements those tests.
#389 recovery mechanics are independently tested in their own worktree.

## Progress

- Real-auth integration passed 132/132, including all seven Slide read/mutation
  operations for valid admin-only, revoked, suspended and forced-change identities.
- No metadata leak found: logger's existing allowlist already redacts unlisted
  fields; added explicit author/cursor classification and synthetic regression cases.
- Browser audit initially assumed no-store for the Next dev page shell. Installed
  Next 16.3.1 base-server explicitly emits no-cache/must-revalidate for dev pages;
  corrected that assertion and additionally inspect raw shell for protected text.
  Protected API bodies retain strict no-store assertions. No runtime control waived.
- Separate review covers source of ChurchScope, scoped cursors/locks, body-only
  audience, terminal late-response guards and unchanged production approval scope.
