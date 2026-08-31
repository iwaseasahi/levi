# Initial-release Chrome E2E evidence

Issue #57 completes the initial-release browser contract with deterministic
synthetic data and the Chromium version pinned by the repository's Playwright
release. CI installs that browser afresh and runs with retries disabled.

## Acceptance matrix

| Release behavior                                  | Playwright evidence                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator creates a Church account                 | `operator-provisioning.spec.ts` submits the protected invitation form and rejects duplicate provisioning.                                                                                   |
| New Church account can start                      | The invitation scenario consumes a synthetic 72-hour email setup link, selects a password, and enters the Ginmaku-compatible Church screen.                                                 |
| Church login, persistence, and logout             | `church-authentication.spec.ts` verifies refresh, a second same-origin window, logout, expiry, and explicit revocation.                                                                     |
| Self-service recovery and stale-session rejection | Password-recovery E2E requests and consumes a synthetic email link, changes the password, and proves the previous session is denied.                                                        |
| Japanese, NKJV, and bilingual search              | `scripture-search-validation.spec.ts` checks the Ginmaku table's 4-column/22-row order, all three language selections, validation focus, and direct audience-tab opening without a preview. |
| Separate direct audience tab                      | `scripture-projection-navigation.spec.ts` keeps the search tab open, opens an ordinary tab, and checks audience-only content and its `chapter:verse` heading.                               |
| Direct Ginmaku controls                           | The projection/navigation scenario checks the audience handshake; text larger/smaller changes its font and the search controls change previous/next scripture.                              |
| Ginmaku keyboard navigation                       | The projection/navigation scenario verifies Up/Down navigation beyond the selected end and across chapter and book boundaries without scrolling.                                            |
| End, chapter, and book boundaries                 | The projection/navigation scenario crosses the selected end verse, both directions across chapters, and both directions across Genesis/Exodus.                                              |
| Audience recovery                                 | `scripture-window-recovery.spec.ts` verifies reload, close detection, disabled controls, and reopening the direct audience tab.                                                             |
| Folder and bookmark lifecycle                     | `scripture-saved-content.spec.ts` creates, pins, marks recent, renames, reorders, reopens, deletes a bookmark, and physically deletes its folder.                                           |
| Tenant denial                                     | `scripture-tenant-isolation.spec.ts` proves foreign and guessed folder IDs return indistinguishable 404 responses.                                                                          |
| Runtime and accessibility                         | Shared fixtures fail on unexpected browser errors from the search tab and popup tabs; Axe checks search, audience, saved content, forced-change, and operator surfaces.                     |

## Secret and artifact boundary

The invitation and password-reset specs necessarily handle live synthetic
single-use tokens. Those files set screenshot, trace, and video to `off`, so the
token cannot enter the E2E artifacts uploaded by CI. They assert only behavior
and never print the value. All other retained artifacts use
synthetic `.invalid` identities and synthetic scripture; no production data is
used.

Failures are synchronized on URL, focus, status text, DOM state, new-tab events,
computed style, and scroll position. The suite contains no explicit sleep and
the Playwright configuration keeps `retries: 0`. Scripture scenarios share only
the read-only synthetic catalog. Each scenario creates and deletes its own
Church, user, account, session, folder, and bookmark state; Playwright supplies
a fresh browser context. The login contract remains in
`church-authentication.spec.ts`; scripture scenarios install their isolated,
signed synthetic session cookie directly so parallel execution cannot consume
the production-equivalent login rate-limit budget.
