# Administration Basic authentication runbook

The administration UI uses two boundaries: HTTPS Basic authentication first,
then an individual `admin_users` login. The Basic credential maps to a
deterministic `BOOTSTRAP` row and remains the outer break-glass boundary; it is
not an individual administrator session. Church users continue to use `/login`
and cannot enter administration.

## Configure credentials

Run this from an interactive terminal:

```sh
pnpm admin:hash-password
```

Enter the password twice. The command hides input and prints only an encoded
`ADMIN_BASIC_AUTH_PASSWORD_HASH` assignment. Configure that value together with
a non-secret `ADMIN_BASIC_AUTH_USERNAME`. Treat the generated verifier as
Restricted: do not place it in source control, Issues, pull requests, logs, chat,
or agent prompts. Do not set an `ADMIN_BASIC_AUTH_PASSWORD` variable.

Local development may place both values in the untracked `.env` file. Production
values belong in the host's protected `production.env`; changing that file
remains a separate secret/access operation requiring explicit authorization.
Ordinary application releases use the standard production deployment flow.

## Operate safely

- Open administration only through the production HTTPS origin. Basic
  credentials are merely encoded on the wire and are unsafe over HTTP.
- Five failed attempts within 60 seconds temporarily block all administration
  authentication. Wait at least 60 seconds before retrying.
- Use the administration sidebar's **ログアウト** button to revoke the current
  database session. Chrome may still cache the outer Basic credential; close all
  Chrome windows or use a separate profile when that outer credential must also
  be forgotten.
- Rotate the credential by generating a new verifier, updating the protected
  environment, and completing the approved deployment/restart workflow. Verify
  the old password is rejected and the new password reaches
  `/admin/login`.
- An unavailable configuration, database, or bootstrap administrator returns `503` and
  must be repaired rather than bypassed.

## Invite another administrator

1. Open `/admin/admin-users` through the production HTTPS origin.
2. Enter the administrator name and a unique login ID. Login IDs are normalized
   to lowercase and may contain ASCII letters, numbers, `.`, `_`, `@`, and `-`.
3. Select **管理者を招待** and reveal the generated temporary password.
4. Transfer the login ID and temporary password only through a verified
   face-to-face or voice channel, then close the one-time display. Levi stores
   only the password hash and cannot show the temporary password again.
5. The administrator opens `/admin/login` after passing Basic authentication,
   signs in, and replaces the temporary password before any management page is
   available.

The row remains `INVITED` until the password change completes, then becomes
`ACTIVE`. The application session expires after 30 days. Logout revokes the
current session; suspension, deletion, or expiry is rejected on the next
request.

## Recover a lost individual administrator password

The one-time temporary password cannot be recovered because Levi stores only
its password hash. If no individual administrator session is available, use
the SSH and `sudo` protected recovery path. Do not add a Basic-only bypass to
the web UI.

First, choose a new temporary password and generate its hash on the operator
Mac from an interactive terminal:

```sh
mise exec -- pnpm admin:hash-password
```

Keep the entered password in the approved password manager. Copy only the
printed `ADMIN_BASIC_AUTH_PASSWORD_HASH=...` assignment, then run:

```sh
ssh -t levi-system-production \
  'sudo /opt/levi/scripts/reset-production-admin-user-password.sh'
```

Enter the target login ID and paste the generated hash at the hidden prompt.
The command accepts only an existing `INVITED` or `ACTIVE` administrator,
creates an encrypted operational backup before the write, restores the account
to `INVITED`, requires a password change, and revokes all of that
administrator's existing sessions. The `BOOTSTRAP` identity and suspended
administrators cannot be reset through this command.

## Deployment prerequisite

Before deploying the migration that requires individual login, create at least
one invited administrator through the existing Basic-protected UI and retain
the one-time credential safely. After deployment, verify `/admin/login`, forced
password change, `/admin`, logout, rejection of the temporary password, and
login with the selected password. Do not remove the Basic configuration; every
administration request still requires it.
