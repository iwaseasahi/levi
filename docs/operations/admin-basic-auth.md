# Administration Basic authentication runbook

The administration UI currently uses HTTP Basic authentication. The credential
maps to a deterministic `BOOTSTRAP` row in `admin_users`; Church users continue
to use `/login` and cannot enter administration.

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
values belong in the host's protected `production.env`; changing that file or
deploying it requires the normal separate production approval.

## Operate safely

- Open administration only through the production HTTPS origin. Basic
  credentials are merely encoded on the wire and are unsafe over HTTP.
- Five failed attempts within 60 seconds temporarily block all administration
  authentication. Wait at least 60 seconds before retrying.
- There is no administration logout button. Chrome may cache Basic credentials
  for the browser session; close all Chrome windows or use a separate profile
  after administration work.
- Rotate the credential by generating a new verifier, updating the protected
  environment, and completing the approved deployment/restart workflow. Verify
  the old password is rejected and the new password reaches
  `/admin/churches/new`.
- An unavailable configuration, database, or bootstrap administrator returns `503` and
  must be repaired rather than bypassed.

Creating an invited administrator record does not grant access while Basic
authentication remains active. Individual administrator sessions, activation,
revocation, and Basic removal are tracked by #259 and ADR 0009.
