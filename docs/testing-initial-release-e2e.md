# Initial-release Chrome E2E evidence

Issue #57 completes the initial-release browser contract with deterministic
synthetic data and the Chromium version pinned by the repository's Playwright
release. CI installs that browser afresh and runs with retries disabled.

## Acceptance matrix

| Release behavior                           | Playwright evidence                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator creates a Church account          | `operator-provisioning.spec.ts` submits the protected form, verifies one-time output, and rejects duplicate provisioning.                                                                 |
| New Church account can start               | The same scenario uses the emitted one-time password, reaches forced change, selects a password, and enters the Ginmaku-compatible Church screen.                                         |
| Church login, persistence, and logout      | `church-authentication.spec.ts` verifies refresh, a second same-origin window, logout, expiry, and explicit revocation.                                                                   |
| Operator reset and stale-session rejection | `password-lifecycle.spec.ts` establishes an old Church session, resets through the operator UI, proves the old page is denied, then completes one-time login and forced change.           |
| Japanese, NKJV, and bilingual search       | `scripture-search.spec.ts` checks the Ginmaku table's 3-column/22-row order, all three language selections, omitted-end normalization, and direct audience-tab opening without a preview. |
| Separate direct audience tab               | The scripture flow keeps the search tab open, opens a real ordinary named tab, and checks audience-only content and its `chapter:verse` heading.                                          |
| Direct Ginmaku controls                    | The search screen enables controls after the audience handshake; text larger/smaller changes its font and scroll up/down changes previous/next scripture.                                 |
| Ginmaku keyboard navigation                | The audience's Up/Down keys navigate backward/forward beyond the selected end and across chapter and book boundaries without scrolling.                                                   |
| End, chapter, and book boundaries          | Navigation crosses the selected end verse, both directions across chapters, and both directions across Genesis/Exodus.                                                                    |
| Audience recovery                          | Reload restores the canonical URL selection, while closing and pressing `Open` again creates the direct audience tab.                                                                     |
| Folder and bookmark lifecycle              | The scripture flow creates, pins, marks recent, renames, reorders, reopens, deletes a bookmark, and physically deletes its folder.                                                        |
| Tenant denial                              | Authenticated access to both a foreign folder ID and a guessed folder ID returns indistinguishable 404 responses.                                                                         |
| Runtime and accessibility                  | Shared fixtures fail on unexpected browser errors; Axe checks search, audience, forced-change, and operator surfaces.                                                                     |

## Secret and artifact boundary

The provisioning and password-reset specs necessarily handle live synthetic
one-time passwords. Both files set screenshot, trace, and video to `off`, so the
credential cannot enter the E2E artifacts uploaded by CI. They assert only
length and behavior and never print the value. All other retained artifacts use
synthetic `.invalid` identities and synthetic scripture; no production data is
used.

Failures are synchronized on URL, focus, status text, DOM state, new-tab events,
computed style, and scroll position. The suite contains no explicit sleep and
the Playwright configuration keeps `retries: 0`. The complete scripture flow
has a 60-second scenario budget because it intentionally covers three searches,
multiple audience-tab lifecycles, and the full saved-content lifecycle on the two-core
CI runner; individual assertions still use observable state waits.
