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
are: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC-BY-4.0, EPL-2.0, ISC,
LGPL-3.0-or-later, MIT, `MIT and ISC`, and Unlicense. This is an inventory gate,
not legal advice or blanket approval for a new direct dependency. EPL/LGPL and
content licenses require impact review when packaging, modifying, or
redistributing the relevant work changes.

`pnpm security:licenses` produces a minimized report containing dependency name,
version, and declared license. Any new license expression fails until this file
and the checker are deliberately updated.
