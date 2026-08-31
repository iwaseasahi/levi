# Slide schema rollout and deletion-aware recovery

Issue #389; [ADR 0015](../architecture/0015-church-owned-slides.md) and
[Slide contract](../product/slide-contract.md). Only disposable synthetic
rehearsals are authorized here. No production migration, import, deployment or
restore has been performed.

## Expansion and rollback

1. Obtain immediate approval for the exact production schema/application target
   under governance, with pre-change backup and rollback artifacts identified.
2. Apply immutable migration `20260831050000_church_owned_slides` before deploying
   the Slide application. It adds one church-owned table, checks, FK and indexes;
   it does not rewrite Bible, Folder, Bookmark or authentication records.
3. The previous application remains compatible with the expanded schema: it does
   not read the new table. `pnpm db:check` checks migrations, drift and seeded
   connectivity; the rehearsal applies the expansion against populated synthetic
   Bible/Folder/Bookmark rows and compares their full values inside a rollback-only
   transaction. Schema integration tests enforce field/FK/index and deletion rules.
4. On application rollback, retain the Slide table and its data. Revert the
   application, then fix forward. Never drop the table as an automatic rollback;
   losing newly created Slides requires a separate explicit data decision.
5. Existing projector/controller tabs must reload together for projection v2.

## No legacy Slide import

Parent #38 excludes old Slide data. The public Ginmaku commit
`4b18adb02ac8011630c76137c60038e168f05534` is source evidence only. No real dump was
read; the Bible importer, its accepted tables, rights/provenance requirements and
mapping are unchanged. New Levi Slides start empty. A future legacy Slide import
needs its own Issue, ownership/mapping rules, rights and data-handling approval,
synthetic rehearsal, and separately approved production operation.

## Backup and deletion boundary

Physical deletion removes the live record and its church-owned cascade. It does
not immediately purge encrypted backup archives (weekly 30 days; operational
48 hours). Restoring an older archive can restore a deleted Slide, church,
identity or old credential state. The backup alone cannot tell which later
records were deleted. No soft deletion, edit history or hidden content log is
introduced to solve this.

Before promotion, the recovery operator must:

1. Verify the exact archive and isolated target. v2 archives include a Slide
   count/fingerprint over **all** stored fields, including ID, church, text,
   revision and timestamps. v1 archives remain accepted with their original
   reconciliation; they have no independent Slide fingerprint and require a
   separate approved Slide comparison if they already contain that table.
2. Review changes since the recovery point using the approved incident/deletion
   record and, when available, a trusted current source. Obtain explicit church
   IDs and `(church_id, slide_id)` deletion pairs; keep content and identifiers in
   the approved restricted recovery record, not public Issues or application logs.
3. Reapply authorized deletions in the isolated target before traffic returns.
   Scope single-Slide deletion by both IDs; church deletion includes its aggregate,
   memberships and user/credential cleanup using the existing deletion rules.
   Compare surviving other-tenant Slides and Bible/Folder/Bookmark data. Do not
   infer that every row absent from a damaged source was intentionally deleted.
4. Confirm both church and administrator session counts are zero. Reconcile
   account status, password resets, invitations and memberships since backup.
5. Bind the promotion approval to the target, archive, completed deletion review,
   affected scope/counts and residual loss. If evidence is missing or ambiguous,
   **do not promote**: ask for the smallest recovery decision. The existing
   immediate approval boundary is unchanged; a successful restore is not approval.

`pnpm backup:rehearse` uses uniquely named local databases and ephemeral encrypted
archives. It backs up three synthetic Slides in two churches, deletes one Slide
and another church after the backup, restores/reconciles the archive, reapplies
that explicit deletion set, and verifies the surviving Slide fingerprint and
unrelated Bible/bookmark data. Both kinds of restored session are invalidated.
It also rejects a deliberately wrong v2 Slide fingerprint and restores a v1
manifest. All temporary databases, archives and keys are removed on exit.

The rehearsal proves mechanics with synthetic data, not production capacity,
content migration or an actual deleted-record inventory. SLIDE parity remains
in progress until #388 and #390 acceptance gates are complete.
