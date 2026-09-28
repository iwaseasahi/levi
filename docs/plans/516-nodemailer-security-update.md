# Nodemailer security update

Issue: #516

## Outcome

Restore the required Security gate by moving Levi from vulnerable, unsupported
`nodemailer@9.0.6` to exact-pinned `nodemailer@10.0.10` without changing mail
delivery behavior.

## Plan

- [x] Confirm the advisory, patched release, supported upstream line, current
      registry version, runtime compatibility, and TypeScript migration guidance.
- [x] Update the direct dependency and remove obsolete external type declarations.
- [x] Verify the frozen install, mail/type compatibility, security audit,
      canonical checks, and final dependency diff.
- [ ] Open an Issue-linked PR, obtain exact-head required CI, merge, and then
      refresh blocked PR #518 against the repaired main branch.

## Decisions

- Use `10.0.10` instead of the minimum patched `9.1.0` because Nodemailer only
  supports security fixes on the 10.x line and Levi's Node.js 24 runtime exceeds
  its Node.js 20 minimum. Versions 10.0.11 and 10.0.12 are newer, but were
  published inside the repository's seven-day release-age window; 10.0.10 was
  published 14 days earlier and needs no supply-chain policy exception.
- Remove `@types/nodemailer`; Nodemailer 10 bundles compatible declarations and
  upstream warns that keeping the external package causes conflicts.

## Risks and mitigations

- Risk: a major-version type or runtime incompatibility changes SMTP delivery.
  - Mitigation: keep all mail code unchanged unless compilation requires a
    focused compatibility fix, and run mail unit/integration coverage plus the
    canonical build.
- Risk: a new dependency license or transitive package enters production.
  - Mitigation: inspect the lockfile and run the repository license inventory;
    Nodemailer remains zero-dependency and MIT-0.

## Verification

- [x] `pnpm install --frozen-lockfile` — passed
- [x] `pnpm typecheck` — passed with Nodemailer's bundled declarations
- [x] focused mail tests — 9 passed
- [x] `pnpm security:check` — passed; no high or critical advisories and 356
      approved production license records
- [x] `pnpm check` — passed, including 539 unit tests, 124 component tests, and
      the production build
- [x] `git diff --check` — passed
- [ ] required exact-head CI

## Result

The dependency-only patch is locally complete. Required exact-head CI and merge
remain pending.
