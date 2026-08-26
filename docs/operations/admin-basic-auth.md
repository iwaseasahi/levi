# Administration authentication and email runbook

The administration UI has two independent authentication boundaries. HTTPS
Basic authentication remains the outer break-glass boundary. Behind it, each
administrator signs in through a dedicated Better Auth realm backed by
`admin_users`, `admin_accounts`, `admin_sessions`, `admin_verifications`, and
`admin_rate_limits`. Church users use a different Better Auth realm and cannot
enter administration.

## Basic authentication

Generate the Basic verifier from an interactive terminal:

```sh
pnpm admin:hash-password
```

Store the resulting `ADMIN_BASIC_AUTH_PASSWORD_HASH` and the non-secret
`ADMIN_BASIC_AUTH_USERNAME` in the untracked local `.env` or the root-owned
production environment. Never store the plaintext password. Chrome may cache
this outer credential; closing every Chrome window or using a separate profile
is required to forget it.

## Administrator invitation

1. Open `/admin/admin-users` through the production HTTPS origin.
2. Enter the administrator name, unique email address, and unique login ID.
3. Select **管理者を招待**.
4. Levi sends a one-hour password setup link to the email address. It never
   displays or transfers a temporary password.
5. The invited administrator opens the link, chooses a password, and signs in
   at `/admin/login` with the login ID and selected password.

An invitation starts as `INVITED`. Successful password setup changes it to
`ACTIVE` and revokes any prior session. An active administrator can be deleted
by another active administrator. The current administrator cannot delete their
own account.

## Password reset

An administrator selects **パスワードを忘れた場合** on `/admin/login`, enters
their email address, and receives a one-hour reset link. The response is the same
whether or not the address exists. Successful reset revokes all administrator
sessions. The outer Basic authentication is still required for the reset pages.

## Local mail

Development uses Mailpit from `compose.development.yaml`:

- SMTP: `127.0.0.1:1125`, without authentication
- Inbox: <http://localhost:8026>
- Sender: `levi-system@localhost.test`

Run `mise run setup` or `pnpm db:up:dev` to start it. No local message leaves the
machine. Copy a password setup/reset URL from the Mailpit inbox and open it in
the same local origin used to request it.

## Production Gmail

Production sends through `levi-system@gmail.com` with a Google app password:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=levi-system@gmail.com
SMTP_PASSWORD=<Google app password>
MAIL_FROM=levi-system@gmail.com
```

The app password belongs only in `/etc/levi/production.env` with mode
`600 root:root`. Runtime validation rejects production SMTP hosts other than
Gmail and rejects unauthenticated submission. Gmail outage failover, queues,
and retries are intentionally out of scope.

Before the first production deploy, also create a distinct 64–128 character
lowercase-hex `ADMIN_BETTER_AUTH_SECRET`. It must not equal
`BETTER_AUTH_SECRET`. Do not display either secret.

Existing administrator rows receive a non-deliverable `@pending.invalid`
address during migration. After deployment, keep the existing login working,
use it to invite a replacement administrator with the real email address,
complete that invitation, sign in as the replacement, and delete the old
placeholder administrator. This uses the normal audited UI and avoids direct
production database edits. Do not send a reset request to a placeholder.

## Verification

- Basic authentication still protects every `/admin` and `/api/admin-auth`
  request.
- Administrator login creates a separate 30-day database session.
- Invitation and reset links expire after one hour and cannot be reused.
- Password reset revokes existing administrator sessions.
- Local mail appears only in Mailpit.
- Production secret validation succeeds without printing values.
