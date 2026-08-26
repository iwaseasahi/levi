# Issue #343: production Gmail sender

## Goal

Use `levi.system.app@gmail.com` as the authenticated Gmail SMTP identity and
message sender in production without exposing its app password.

## Implementation

- Update the production environment template.
- Require the exact sender identity in compose and secret validation checks.
- Update the administrator email operations runbook.
- Keep the Gmail app password exclusively in the root-owned
  `/etc/levi/production.env` file.

## Verification

- [x] `mise exec -- pnpm check`
- [x] `mise exec -- pnpm security:check`
- [ ] Required CI succeeds

Production secret installation and deployment are intentionally separate from
this source change and require explicit approval of the exact artifacts.
