# Issue #276: production secret preparation

## Outcome

Prepare separated production runtime, database, Basic administration, ACME, and
backup encryption credentials without placing their values in Git, Issues,
shell history, CI, or ordinary logs.

## Automated boundary

`scripts/check-production-secrets.sh` performs a non-disclosing host check. It
requires root-owned mode-600 runtime, backup, and monitoring environment files;
checks the public backup certificate without accepting a private key; rejects
placeholders; verifies the application and migration database credentials are
different and consistently referenced; requires digest-pinned images; and runs
Docker Compose configuration validation with no rendered output.

The command never prints parsed environment values. Its only successful output
is a fixed confirmation sentence, and every configuration failure returns the
same generic message.

## Human gate

The product owner performs or immediately approves all value-bearing steps:

1. Generate the Basic authentication verifier locally with
   `pnpm admin:hash-password` and store the password in the approved password
   manager.
2. Generate the encrypted RSA 3072-bit backup private key on the operator Mac,
   keep it offline, and transfer only the public certificate to the VPS.
3. Generate distinct 32-byte hexadecimal PostgreSQL admin/application
   passwords and a 32-byte-or-longer Better Auth secret without putting values
   in command arguments or history.
4. Enter the ACME contact and protected values directly into
   `/etc/levi/production.env` through an interactive root editor.
5. Install `backup.env` and `monitoring.env` as `600 root:root`, then run the
   validator through `sudo`.

No production secret value is generated, read, transported, or recorded by the
coding agent.

## Rotation ownership

- The Levi operator owns the password-manager records, offline recovery key,
  rotation approval, and emergency revocation.
- Database credentials rotate through a separately approved maintenance window
  with a backup and forward-recovery plan.
- Rotating `BETTER_AUTH_SECRET` invalidates authentication cookies and requires
  all users to sign in again.
- Basic authentication rotates by replacing its scrypt verifier and restarting
  the application; the old password must then be rejected.
- A replacement backup certificate applies only to new archives. Retain the
  matching old offline private key until every archive encrypted to it expires.

## Verification

```bash
sudo /opt/levi/scripts/check-production-secrets.sh
```

Expected output contains no value:

```text
Production secret configuration passed without disclosing values.
```
