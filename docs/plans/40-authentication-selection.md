# Select the identity and authentication architecture

## Issue

- Issue: #40
- Branch: `codex/issue-40`
- Base commit: `904150bee540aedbd23172bc2e493018dcee335a`

## Outcome

The authentication selection gate is replaced by an accepted, testable decision
covering identity, tenancy, credentials, sessions, recovery, abuse prevention,
and transactional email boundaries.

## Context

- `docs/architecture/0004-authentication-selection-gate.md`
- `docs/product/initial-release-spec.md`
- `docs/security/authentication-authorization.md`
- `docs/security/threat-model.md`
- Issue #40 approval comment and the product-owner approval on 2026-08-21
- Version-matched Next.js authentication guide under `node_modules/next/dist/docs`
- Official Better Auth, Auth.js, Resend, and AWS SES documentation

## Constraints

- Authentication must be self-hosted and must not use model-provider APIs.
- Production services, domains, secrets, email, deployment, and migrations are
  not authorized by this Issue.
- Tenant authorization remains a Levi domain responsibility.
- The accepted solution must work with pinned Next.js, Prisma, and PostgreSQL.

## Non-goals

- Installing or integrating Better Auth
- Creating a Resend account, credential, or sending domain
- Creating production users or data

## Plan

1. [x] Compare current official authentication and email options.
2. [x] Obtain the product/security-owner decision.
3. [x] Record the accepted ADR and supersede the selection gate.
4. [x] Align security, operations, open decisions, and dependent Issues.
5. [x] Run repository checks, open a PR, verify CI, and merge.

## Progress

- 2026-08-21 13:32 JST — Started; read Issue #40, local Next.js 16 docs,
  existing security policy, and schema foundation.
- 2026-08-21 13:34 JST — Compared Better Auth, Auth.js Credentials, hosted
  identity, Resend, and AWS SES using current primary documentation.
- 2026-08-21 13:35 JST — Product/security owner approved self-hosted Better Auth,
  PostgreSQL sessions, a provider-neutral email port, and Resend Free as the
  initial production candidate.
- 2026-08-21 13:35 JST — Added accepted ADR 0006 and superseded ADR 0004.
- 2026-08-21 13:39 JST — Aligned authentication policy, threat model,
  credential boundaries, open decisions, and Issues #41 through #45 with ADR 0006.
- 2026-08-21 13:39 JST — Local quality, integration, E2E, and security checks
  passed; the change is ready for PR verification and merge.

## Decisions

- 2026-08-21 — Decision: Better Auth owns authentication primitives; Levi owns
  actor and tenant authorization.
  - Reason: minimizes custom credential security code and usage fees without
    weakening tenant boundaries.
  - Alternatives: Auth.js Credentials, hosted identity, custom auth.
  - ADR: `docs/architecture/0006-better-auth-database-sessions.md`
- 2026-08-21 — Decision: use revocable DB sessions with no cookie cache initially.
  - Reason: suspension and reset must take effect on the next protected request.
- 2026-08-21 — Decision: keep email provider-neutral and use Resend Free as the
  approved initial production candidate.
  - Reason: low initial cost and simpler operations; no external account or paid
    overage is authorized here.

## Risks and mitigations

- Risk: Better Auth stores its session lookup token in the session table.
  - Mitigation: classify the table as Restricted, keep sessions short/revocable,
    harden DB/backups, and reconsider if hashed-at-rest becomes mandatory.
- Risk: latest-only upstream security support creates upgrade pressure.
  - Mitigation: exact pinning, dependency monitoring, schema diff review, full
    auth regression suite, and migration rehearsal.
- Risk: account provisioning spans auth and tenant concerns.
  - Mitigation: require Issue #43 to prove atomicity or a safe inactive pending
    state and compensation.

## Verification

- [x] `pnpm format:check` — passed
- [x] `pnpm lint` — passed
- [x] `pnpm check` — typecheck/build, 17 unit, and 2 component tests passed
- [x] `pnpm test:integration` — 5 tests passed
- [x] `pnpm test:e2e` — configured Chromium walking skeleton passed
- [x] `pnpm security:check` — no high production vulnerabilities; 214 licenses
      approved
- [x] Dependent Issue requirements match ADR 0006
- [x] Final diff contains no secret, credential, account, or production action

## Handoff or blockers

- Completed: option research, human decision, accepted ADR, and dependent
  artifact alignment.
- Remaining: commit, verify required CI on the PR head, and merge.
- Blocker: none.
- Resume with: commit the verified documentation change.

## Result

ADR 0006 accepts Better Auth with revocable PostgreSQL sessions and a
provider-neutral transactional-email port, with Resend Free as the approved
initial production candidate. Security and dependent planning artifacts match
the decision. No dependency, account, credential, domain, email, production
system, or production data was created or changed.
