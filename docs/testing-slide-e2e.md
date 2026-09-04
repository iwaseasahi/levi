# Slide browser acceptance and delivery evidence

Parent #59 defined the contract; children #382–#390 deliver the runtime. This
checklist records synthetic local and required-CI evidence, not a production
release or approval to import old Slides. Contract:
[`product/slide-contract.md`](product/slide-contract.md), ADRs 0015 and 0016.

## Acceptance map

| Behavior                                                                                        | Executable evidence                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create → body-only unsaved preview → save → list → projection → edit/reopen → physical delete   | `tests/e2e/slide-lifecycle.spec.ts` uses the UI across controller, editor and audience. Confirms preview does not save/open/project, including while another saved Slide is on screen.                                                                                                                                              |
| Validation, EOL, consecutive-newline preservation, Unicode and literal HTML                     | `src/domain/slides/slide.test.ts`, editor component/E2E, projection E2E. Same normalized body and `SlideText` fit for preview/audience.                                                                                                                                                                                             |
| Creation-order list 20 + Back/Next, equal timestamps, strict cursor and removed query rejection | `slide-list.spec.ts`, `tests/integration/slide-list.test.ts`, list domain/controller and component tests.                                                                                                                                                                                                                           |
| Empty, loading, failed read and explicit retry                                                  | List component tests and lifecycle E2E with a controlled 503 until user retry. No automatic request-count assumption under React StrictMode.                                                                                                                                                                                        |
| Concurrent edit and stale delete                                                                | Lifecycle E2E has two real editor tabs: 409 preserves unsaved title/body and focuses the error; original saved revision/body remains. CRUD integration/API E2E covers stale delete and racing writers.                                                                                                                              |
| Complete-body projection, acknowledged blank and font controls                                  | `slide-projection.spec.ts`, lifecycle E2E, projection component/transport tests. Font 60–220% boundaries remain shared transport responsibility.                                                                                                                                                                                    |
| One-image upload, normalized storage, preview, contain projection and blank                     | `slide-image-lifecycle.spec.ts`, image editor/projection components, decoder unit tests and `slide-image.test.ts`. The audience is a black 16:9 surface; image Slides expose no font controls.                                                                                                                                      |
| Reopen/reload/invalid query/scripture switch/old controller                                     | `slide-projection.spec.ts`, `projection-connection.spec.ts`, `scripture-window-recovery.spec.ts`; shared transport component tests include blocked windows and readiness/timeout cases.                                                                                                                                             |
| Deleted/edited/foreign/revoked/suspended audience                                               | Projection/security/lifecycle E2E; `project-slide.test.ts` and projection components prove terminal failure and rejection of delayed reads/commands.                                                                                                                                                                                |
| Tenant metadata, forged church/cursor, admin-only identity, user/church deletion                | `slide-security.spec.ts`, `slide-authorization.test.ts`, CRUD/search/schema/deletion integration and the [tenant audit](security/tenant-isolation-review.md#slide-aggregate-audit-388).                                                                                                                                             |
| Keyboard/IME/focus and accessibility                                                            | Lifecycle verifies composition does not navigate, ordinary arrows do, and delete cancel/error focus is restored. Editor components cover input/textarea/IME preservation; transport tests cover modified shortcuts/contenteditable. Editor/list/controller at 390/1280 and audience at 1280×720/1920×1080 pass geometry/axe checks. |
| Existing published workflows                                                                    | Entire scripture/search/bookmark/folder/auth/operator suite runs unchanged except the separately merged #400 synthetic Basic-auth fixture correction.                                                                                                                                                                               |
| Expansion, drift and image/deletion-aware restore                                               | `pnpm db:check`, schema integration and `pnpm backup:rehearse`; the synthetic image byte hash is reconciled by [backup/restore](operations/backup-restore.md). No legacy Slide data imported.                                                                                                                                       |

## List UI simplification (#412)

The `/slides` UI shows the creation-order list directly, with no recent/all
switches or body-search form. Issue #397 also removes those dormant API modes.
List component/E2E cover rows, title, pagination, stale responses,
empty/error/retry and 390px/1280px geometry. Domain/controller/integration tests
cover strict cursors, tenant scope, and rejection of removed query parameters.

## Evidence and artifact boundary

Use canonical `pnpm test:e2e` (Chromium pinned by lockfile), `pnpm check`,
`pnpm test:integration`, and `pnpm security:check`. Retries are zero. Tests wait
for observable DOM/ACK/database state; they do not wait a guessed delay. Failure
artifacts remain in ignored `test-results/playwright` and the Playwright report;
CI attaches reports with the existing retention policy. Successful synthetic
screenshots cover editor/search/controller/audience widths and Japanese line fit.
Visual review accompanies geometry/axe checks; very long unbroken lines shrink
inside the fixed 16:9 surface and may be small, as expected from fit-to-frame.

No production text, dump or credentials are used. Scripture fixtures create
short-lived synthetic sessions. Administration scenarios continue to disable
screenshots/traces/videos; temporary restore archives and keys are cleaned up.
Expected 404/409/503 browser errors are registered by exact message only in their
own negative test. Unexpected console/page/hydration errors remain failures.

Next dev page shells emit no-cache/must-revalidate; protected Slide API responses
are strictly no-store, and the shell/foreign DOM are checked for protected text.
The audience displays body, blank or generic recovery feedback only. Revalidation
is on visibility and every 30 seconds, not instantaneous remote erasure.

## Merged implementation chain

| Issue             | Pull request | Delivered scope                                                        |
| ----------------- | ------------ | ---------------------------------------------------------------------- |
| #59               | #391         | Pinned legacy contract, accepted ADR and child decomposition           |
| #382              | #392         | Church-owned schema, checks/FK/index and deletion                      |
| #383              | #393         | Validation/EOL and legacy page domain, simplified by #424              |
| #394 (under #384) | #395         | Scoped CRUD API and revision concurrency                               |
| #384              | #396         | CRUD editor and unsaved preview                                        |
| #385              | #398         | Historical search/recent delivery; list pagination retained after #397 |
| #386              | #399         | Shared versioned audience transport                                    |
| #400              | #402         | Authenticated E2E Basic challenge race correction                      |
| #387              | #401         | Saved Slide audience and acknowledged controls                         |
| #389              | #403         | Expansion and compatible deletion-aware recovery                       |
| #388              | #404         | Cross-route tenant and revocation audit                                |

#390 supplies this final acceptance layer. Its PR records exact commands/counts,
head SHA, required `Quality`/`Database`/`E2E`/`Security` run and final outcome.
Only after these tests pass may SLIDE-001/002 be marked verified. Production
schema/application rollout remains separately approved. The user removed the
search performance scope in #397; unmeasured Sunday capacity #302 remains open
and is not represented as completed by synthetic correctness tests.
