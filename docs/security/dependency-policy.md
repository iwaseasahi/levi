# Dependency and CI supply-chain policy

- Production dependencies fail CI for known `high` or `critical` advisories.
- The lockfile is immutable under frozen install. An audit exception requires a
  dedicated Issue with advisory, reachability, compensating control, owner, and
  expiry; lowering the global threshold is prohibited.
- GitHub Actions are pinned to full commit SHAs with a version comment.
- Dependabot updates pnpm and Actions weekly; its PRs receive the same protected
  Quality, Database, E2E, and Security jobs as any other author.
- New direct dependencies require purpose, maintenance, provenance, and license
  review. Avoid install scripts unless explicitly allowlisted.

The current production dependency license groups reviewed by the automated gate
are: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, CC-BY-4.0,
CC0-1.0, EPL-2.0, ISC, LGPL-3.0-or-later, MIT, MIT-0, `MIT and ISC`, MPL-2.0,
and Unlicense. This is an inventory gate, not legal advice or blanket approval
for a new direct dependency. EPL/LGPL/MPL and content licenses require impact
review when packaging, modifying, or redistributing the relevant work changes.

Better Auth 1.7.1 resolves the newly reviewed groups only through its installed
peer dependency graph: MIT-0 CSS helpers, MPL-2.0 Lightning CSS, BlueOak-1.0.0
`lru-cache`, and CC0-1.0 MDN data. Levi does not modify or redistribute those
packages separately. A dependency update that changes this inventory must fail
the gate for another deliberate review.

Zod 4.3.6 is a direct, exact-pinned dependency for shared untrusted-input
validation at server mutation boundaries and accessible form feedback. Browser
constraints alone do not protect Server Actions, the standard library has no
equivalent email/schema validator, and Better Auth already uses the same pinned
major/version contract.

Tiptap and its ProseMirror packages are exact-pinned at 3.31.3 and are MIT
licensed. They provide selection-aware editing, history, IME/browser handling,
and a constrained schema that the platform APIs do not provide. Levi enables
only paragraphs, flat bullet lists, three alignments, bold, italic, underline,
hard breaks, a visual placeholder, text style, and
60–220% font sizes in 10% steps. The required extensions are exact-pinned and
the result is converted to Levi's own validated versioned document rather than
storing raw editor JSON or HTML.
Dependabot updates require the normal audit, license, component, and browser
checks.

`pnpm security:licenses` produces a minimized report containing dependency name,
version, and declared license. Any new license expression fails until this file
and the checker are deliberately updated.
