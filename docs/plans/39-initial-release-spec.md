# Fix the initial replacement release contract

## Issue

- Issue: #39
- Branch: `codex/issue-39`
- Base commit: `ccef2bcf0e9b33b582a162f412fa58e91f84a2ca`

## Outcome

The confirmed product decisions are durable, internally consistent, linked to
implementation Issues, and testable without the original chat transcript.

## Context

- `docs/product/vision.md`
- `docs/product/non-goals.md`
- `docs/product/glossary.md`
- `docs/migration/parity-matrix.md`
- `docs/migration/vertical-slice-candidates.md`
- `docs/architecture/open-decisions.md`
- Parent Issue #38 and delivery Issues #40 through #59

## Constraints

- This Issue records product behavior; it does not select authentication or
  production providers.
- It does not authorize access to the MySQL dump, Bible text, production, or
  secrets.
- New/changed observable behavior must be distinguished from source-observed
  Ginmaku behavior.

## Non-goals

- Application or database implementation
- Production deployment or migration

## Plan

1. [x] Write the initial-release product specification with examples and UI
       states.
2. [x] Update scope, terminology, slice ordering, open decisions, and parity.
3. [x] Verify formatting, links, Issue coverage, and the final diff.

## Progress

- 2026-08-21 13:23 JST — Started; read Issue #39, governance, migration
  evidence, existing product documents, and ADR gates.
- 2026-08-21 13:23 JST — Completed steps 1 and 2; added the durable release
  contract and reconciled dependent planning documents.
- 2026-08-21 13:27 JST — Completed step 3; all local quality, integration, E2E,
  and security checks passed, and Issues #38 through #59 were confirmed open.

## Decisions

- 2026-08-21 — Decision: Bible search and projection are the first vertical
  slice; slides are mandatory later and songs are optional later.
  - Reason: explicit product-owner decision recorded in Issue #38.
  - Alternatives: the prior source-derived slides-first recommendation.
- 2026-08-21 — Decision: a search range seeds presentation but does not bound
  subsequent navigation.
  - Reason: the legacy range fence prevents the requested worship flow.
- 2026-08-21 — Decision: `last used` means explicit folder selection or bookmark
  reopen, rather than generic row update time.
  - Reason: this makes the recent-folder behavior stable and testable.

## Risks and mitigations

- Risk: Bible content licensing may prevent corpus import.
  - Mitigation: retain a human rights/provenance gate and use synthetic fixtures.
- Risk: authentication details remain undecided.
  - Mitigation: defer provider and lifetimes to Issue #40 while fixing product
    behavior here.

## Verification

- [x] `pnpm format:check` — passed
- [x] `pnpm lint` — passed
- [x] `pnpm check` — 17 unit and 2 component tests passed; typecheck and build
      passed
- [x] `pnpm test:integration` — 5 tests passed
- [x] `pnpm test:e2e` — latest configured Chromium walking skeleton passed
- [x] `pnpm security:check` — no high production vulnerabilities; 214 licenses
      approved
- [x] Markdown links and Issue references inspected
- [x] Every initial must capability maps to a delivery Issue and evidence target
- [x] Final diff reviewed for scope, secrets, and accidental content inclusion

## Handoff or blockers

- Completed: product decisions captured in repository documents.
- Remaining: commit, open PR, verify CI, and merge.
- Blocker: none.
- Resume with: commit the verified documentation change.

## Result

Pending verification and merge.
