# Administration Basic authentication runbook

The initial administration UI at `/admin/churches` is for one platform operator
and uses HTTP Basic authentication. Church users continue to use `/login`.

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
  `/admin/churches`.
- An unavailable configuration, database, or internal operator returns `503` and
  must be repaired rather than bypassed.

Before granting administration access to another person, replace this design
with individual operator accounts and MFA as required by ADR 0008.
