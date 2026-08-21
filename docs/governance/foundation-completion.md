# Autonomous development foundation completion

Issue [#1](https://github.com/iwaseasahi/levi/issues/1) established the
repository, quality, security, migration, and agent workflow needed for coding
agents to continue Levi without human-authored code. This record maps every
epic completion criterion to durable evidence as of 2026-08-21.

## Child delivery

All scoped child Issues were independently implemented and merged in dependency
order:

| Area                                       | Issue                                               | Merged PR                                         |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------- |
| Autonomy and Definition of Done            | [#3](https://github.com/iwaseasahi/levi/issues/3)   | [#13](https://github.com/iwaseasahi/levi/pull/13) |
| Agent instructions and plans               | [#4](https://github.com/iwaseasahi/levi/issues/4)   | [#14](https://github.com/iwaseasahi/levi/pull/14) |
| Architecture and product decisions         | [#5](https://github.com/iwaseasahi/levi/issues/5)   | [#15](https://github.com/iwaseasahi/levi/pull/15) |
| Next.js/TypeScript/pnpm scaffold           | [#6](https://github.com/iwaseasahi/levi/issues/6)   | [#16](https://github.com/iwaseasahi/levi/pull/16) |
| Prisma/PostgreSQL/migrations               | [#7](https://github.com/iwaseasahi/levi/issues/7)   | [#17](https://github.com/iwaseasahi/levi/pull/17) |
| Layered test harness                       | [#8](https://github.com/iwaseasahi/levi/issues/8)   | [#18](https://github.com/iwaseasahi/levi/pull/18) |
| Protected CI gates                         | [#9](https://github.com/iwaseasahi/levi/issues/9)   | [#19](https://github.com/iwaseasahi/levi/pull/19) |
| Issue/PR execution protocol                | [#10](https://github.com/iwaseasahi/levi/issues/10) | [#20](https://github.com/iwaseasahi/levi/pull/20) |
| Legacy parity and migration discovery      | [#11](https://github.com/iwaseasahi/levi/issues/11) | [#21](https://github.com/iwaseasahi/levi/pull/21) |
| Security and operations baseline           | [#12](https://github.com/iwaseasahi/levi/issues/12) | [#22](https://github.com/iwaseasahi/levi/pull/22) |
| Local subscription agent safety foundation | [#2](https://github.com/iwaseasahi/levi/issues/2)   | [#36](https://github.com/iwaseasahi/levi/pull/36) |

The dependency fields in the child Issues define the delivery order. Each PR
was independently mergeable and recorded its verification and operational
impact.

## Epic completion evidence

| Completion criterion                                               | Evidence                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child Issues exist with dependencies and priority                  | Issues #3 through #12 are closed; their bodies link their parent and prerequisite Issues. The table above links every merge.                                                                                                                                                                 |
| A fresh Codex run can set up without oral context                  | [`AGENTS.md`](../../AGENTS.md) is the Codex contract; [`README.md`](../../README.md) documents pinned requirements, clean setup, canonical commands, and instruction discovery. A fresh branch clone passed frozen install, documented `.env.example` setup, and `pnpm check` on 2026-08-21. |
| One command runs the quality gate                                  | `pnpm check` composes format, lint, typecheck, unit/component tests, and production build. GitHub Actions invokes the same repository command.                                                                                                                                               |
| Broken lint, type, unit, migration, and E2E are rejected           | The isolated negative runs below failed in the intended protected job. PR #18 separately records component, coverage, and browser-error negative evidence.                                                                                                                                   |
| Codex completes Issue to PR and CI repair                          | PR #16 delivered the application walking skeleton from Issue #6; PR #20 exercised the structured Issue-to-draft-PR flow; later agent PRs passed the protected gates and were merged without human-authored code.                                                                             |
| PRs retain verification results                                    | [The PR template](../../.github/pull_request_template.md) requires verification, risk, rollback, handoff, and completion evidence. PRs #20, #22, and #36 are representative completed records.                                                                                               |
| Production, secret, and destructive approvals are separated        | [`autonomy.md`](autonomy.md), [`credential-boundaries.md`](../operations/credential-boundaries.md), and [`agent-protocol.md`](../agent-protocol.md) define human-owned approvals and keep production/provider credentials out of normal development and CI.                                  |
| Ginmaku parity is tracked per capability                           | [`parity-matrix.md`](../migration/parity-matrix.md) tracks priority, owner, evidence, acceptance, implementation, and blockers against pinned legacy evidence.                                                                                                                               |
| Humans can avoid writing code while retaining final responsibility | The autonomy policy assigns implementation, tests, review, PR repair, and in-scope merge work to agents; humans retain product/UX decisions, production release, credentials, billing, legal/privacy, and irreversible actions.                                                              |

## Negative CI proof

Temporary commits on draft PR
[#37](https://github.com/iwaseasahi/levi/pull/37) introduced exactly one defect
at a time. Every defect was restored before the final head.

| Probe                                            | Expected failure                                            | GitHub Actions evidence                                                        |
| ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ESLint `no-explicit-any` error                   | `Quality` fails in `pnpm check`                             | [run 32443220893](https://github.com/iwaseasahi/levi/actions/runs/32443220893) |
| TypeScript number-to-string assignment           | `Quality` fails in `pnpm check`                             | [run 32443284463](https://github.com/iwaseasahi/levi/actions/runs/32443284463) |
| Deliberately wrong unit expectation              | `Quality` fails in `pnpm check`                             | [run 32443385130](https://github.com/iwaseasahi/levi/actions/runs/32443385130) |
| Invalid SQL in the initial migration             | `Database` fails in `pnpm db:check`                         | [run 32443510569](https://github.com/iwaseasahi/levi/actions/runs/32443510569) |
| Nonexistent heading in the walking-skeleton test | `E2E` fails in `pnpm test:e2e` and uploads browser evidence | [run 32443622249](https://github.com/iwaseasahi/levi/actions/runs/32443622249) |

The final PR is mergeable only after the restored head passes `Quality`,
`Database`, `E2E`, and `Security`.

## Protected main contract

The GitHub branch-protection API was inspected on 2026-08-21. `main` requires an
up-to-date PR with `Quality`, `Database`, `E2E`, and `Security`; requires zero
human approvals; enforces the rule for administrators; requires linear history;
and disables force pushes and branch deletion. This permits autonomous agent
merges while preserving deterministic technical gates and the human approval
boundaries above.
