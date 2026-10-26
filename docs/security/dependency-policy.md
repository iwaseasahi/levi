# Dependency and CI supply-chain policy

- Production dependencies fail CI for known `high` or `critical` advisories.
- The lockfile is immutable under frozen install. An audit exception requires a
  dedicated Issue with advisory, reachability, compensating control, owner, and
  expiry; lowering the global threshold is prohibited.
- GitHub Actions are pinned to full commit SHAs with a version comment.
- Dependabot checks pnpm and Actions weekly on Monday in `Asia/Tokyo`. Ordinary
  version updates use `cooldown.default-days: 7` for both ecosystems: releases
  become eligible seven days after publication and are considered on the next
  scheduled run. This covers major, minor and patch updates without exclusions.
  Dependabot security updates are outside this native cooldown and are not
  delayed by it; see the
  [GitHub cooldown reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cooldown).
  Dependabot PRs receive the same protected
  Quality, Database, E2E, and Security jobs as any other author. Eligible
  Dependabot PRs automatically squash merge only when those checks and existing
  branch protection pass, including major updates; see
  [`docs/ci.md`](../ci.md#dependabot-auto-merge) for scope and rollback.
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
50–200% font sizes in 10% steps. The required extensions are exact-pinned and
the result is converted to Levi's own validated versioned document rather than
storing raw editor JSON or HTML.
Dependabot updates require the normal audit, license, component, and browser
checks.

`pnpm security:licenses` produces a minimized report containing dependency name,
version, and declared license. Any new license expression fails until this file
and the checker are deliberately updated.

Issue #531 updates Next.js and its matching ESLint config to 16.4.1 (MIT), and
Sharp to 0.35.5 (Apache-2.0), to resolve published advisories. It also exact-pins
the already installed transitive packages `fast-uri` 3.1.8 (BSD-3-Clause),
`source-map-js` 1.2.2 (BSD-3-Clause), `undici` 8.10.2 (MIT), and `vite` 8.2.4
(MIT) through workspace overrides until upstream ranges resolve patched
versions. Prisma, PostCSS, jsdom, and Vitest already require these packages;
the overrides remain within their existing major lines and add no direct
production dependency or license expression. Registry repository, integrity,
publication date, runtime compatibility, and available provenance attestations
were checked before installation. The required production audit and license
inventory remain unchanged.

Issue #543 updates the existing `undici` override from 8.10.2 to 8.12.2
and the direct `zod` pin from 4.5.2 to 4.6.6, with a matching override to update
Better Auth’s independently locked Zod 4 dependency as well. These are the first fixed releases
in the existing major lines for
[GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) and
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
Both retain MIT licensing, official upstream repository metadata, npm SHA-512
integrity and SLSA provenance attestations; undici's Node >=22.19.0 requirement
is compatible with the pinned Node 24.22.1. The override continues to cover
the existing transitive graph and adds no direct production dependency.
The audit threshold, license inventory and compatibility gates remain intact.
