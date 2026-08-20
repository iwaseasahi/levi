# Cutover strategy ADR preparation

Do not select a production migration strategy from source inspection alone. Copy
this analysis into a numbered ADR once runtime topology, operator workflow, data
volume/change rate, downtime tolerance, and rollback constraints are known.

| Strategy                    | Prefer when                                                                                                  | Main risks                                                       | Evidence required before acceptance                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Strangler by vertical slice | Old and new routes/data ownership can be separated with an explicit compatibility boundary                   | Split ownership, cross-system links, prolonged dual operations   | Route/data ownership map, compatibility tests, per-slice rollback, operator runbook                   |
| Parallel run                | Identical approved inputs/outputs can be safely compared without confusing operators or writing twice        | Divergent writes, privacy duplication, ambiguous source of truth | Read-only shadow or deterministic dual-write design, reconciliation thresholds, discrepancy runbook   |
| Single cutover              | System is small, downtime is acceptable, and a rehearsed snapshot migration is faster/safer than coexistence | Large blast radius, stale snapshot, rollback data loss           | Timed full rehearsal, restore proof, write freeze, acceptance checklist, explicit production approval |

## Decision inputs

- Active users/operators, worship schedule, and maximum downtime:
- Legacy hosting, network, browser/projector topology:
- Source database size, write rate, soft-deleted/history volume:
- Content licensing and sensitive-data classification:
- Cross-system dependencies and PDF/file storage:
- Backward/forward compatibility window:
- Backup restoration time and acceptable recovery-point objective:
- Owners for go/no-go, execution, verification, and rollback:

## Mandatory safeguards

- Production data never enters the repository or ordinary agent context.
- Run the complete migration and reconciliation against an approved
  synthetic/anonymized snapshot before requesting production approval.
- Define one source of truth at every phase and reject ambiguous dual writes.
- Record exact stop/go thresholds, monitoring, rollback/forward-recovery steps,
  and the human approval for the specific production action.
