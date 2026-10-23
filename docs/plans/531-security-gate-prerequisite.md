# Restore the Security gate before the Node.js update

## Issue and outcome

- Issue: #531; prerequisite for #530 / PR #532.
- Branch: `codex/issue-531`, base `05c5551`.
- Clear existing high/critical dependency advisories without changing product
  behavior, audit policy, Node.js, or database schema/data.
- Merge order: #531 first, then update #530 against main and repeat verification.

## Context and decisions

- Node.js verification found blocking advisories in the unchanged main-branch
  package graph. The Node.js runtime patch cannot resolve npm package advisories.
- Read ADRs 0001/0003, governance, testing/CI policy, dependency policy, and the
  installed Next.js upgrade documentation before selecting package changes.
- Pin Next.js and eslint-config-next at 16.4.1 and Sharp at 0.35.5, retaining
  existing major versions. Pin four existing transitives through overrides:
  fast-uri 3.1.8, source-map-js 1.2.2, undici 8.10.2, vite 8.2.4. All satisfy
  existing runtime constraints, use existing licenses, and were published over
  seven days before intake. No direct dependency is added.
- Checked npm registry repository, integrity, publication time, engines, and
  provenance availability for each selected version. Next.js, Sharp, Undici,
  and Vite provide provenance; fast-uri and source-map-js do not claim it.
- Primary advisories:
  - <https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw>
  - <https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w>
  - <https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3>
- No major upgrades, application behavior changes, new licenses, audit
  exceptions, test policy changes, or production deployment.

## Plan and verification

- [x] Record separately scoped Issue, inspect advisories, and acquire a lease.
- [x] Update exact pins/overrides, regenerate and format the lockfile.
- [x] `pnpm security:check` — passed; no high/critical findings and 356 approved
      license records. Existing moderate advisories remain in @vitest/mocker and
      mysql2; no audit exceptions were introduced.
- [x] `pnpm install --frozen-lockfile`
- [x] `mise run check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] Separate full-diff review and `git diff --check`
- [ ] Exact-head Quality, Database, E2E, Security; merge before #530.

## Progress

- 2026-10-23 JST — Chose patched versions, updated the package graph, and passed
  the unchanged audit/license gate. No application source edits were needed.
- 2026-10-23 JST — Canonical checks, coverage, and 141 integration tests passed.
  Initial E2E had 34 passes and one deterministic compatibility failure: patched
  Next.js returns `Cache-Control: no-store`, while the old test required
  `no-cache`. Strengthened the page-shell assertion to require the `no-store`
  directive; all content/authorization checks and zero retries remain intact.
  Retained the heading-only managed AGENTS block update verified against
  Next.js's `generate-agent-files.js`.

## Handoff or blockers

- Completed: package updates, provenance/compatibility review, security checks,
  frozen install, canonical checks (539 unit / 126 component), coverage,
  141 integration tests, and all 35 E2E scenarios. Full-diff review confirmed
  exactly 43 package records replaced by the selected packages and their
  platform binaries, without unrelated package updates.
- Remaining: exact-head CI, merge, then refresh #530.
- Blocker: none.
- Resume with: inspect required PR checks and merge when all are successful.
