# Church account lifecycle runbook

This runbook covers the initial operator-managed Church account lifecycle. It
does not authorize production access, secret changes, deployment, or direct
production database mutation. Those actions retain the human approval gates in
`docs/governance/autonomy.md`.

## Before provisioning

1. Verify the Church contact and requested login email using the approved
   operator records. Levi does not verify mailbox ownership in the initial
   release.
2. Confirm that the recipient is available for immediate credential handoff.
3. Open the protected Levi operator page directly. Do not share the operator
   session or use a screen-sharing recording.
4. Enter the canonical Church name, recipient display name, and normalized login
   email. A repeated submission returns a generic failure and must not be treated
   as evidence that an account exists.

## One-time temporary-password handoff

After a successful commit, Levi returns the temporary password once and keeps it
hidden until the operator deliberately reveals it.

1. Use either an in-person handoff or a live voice call to a contact whose
   identity the operator has already verified. Do not record the call.
2. Reveal the temporary password only when the recipient is ready to receive it.
3. Read or show the login email and temporary password. Ask the recipient to
   confirm receipt without repeating the password into a recording or message.
4. Close the credential display immediately. It cannot be reopened.
5. Do not place the value in email, SMS, chat, an Issue, pull request, support
   ticket, agent prompt, screenshot, screen recording, ordinary notes, or logs.

The recipient must change the temporary password at the next login. Until the
change succeeds, Levi permits only the password-change screen and logout. A
successful change verifies the current temporary password, replaces its hash,
clears the forced-change state, and revokes every other session.

## Lost or possibly exposed credential

- Do not create a second Church or a second account to work around a lost
  temporary password.
- Treat a screenshot, message, recording, unintended observer, or uncertain
  handoff as exposure.
- Suspend use of the account and invoke the protected operator reset/reissue
  workflow. That workflow replaces the scrypt hash, revokes all
  sessions, and returns a new temporary password once.
- If the protected reset/reissue workflow is unavailable, keep the account
  unused and escalate; never edit credential rows directly.

## Suspension and resumption

Account suspension is a protected operator operation. It sets the Church to
`SUSPENDED` with a timestamp and revokes every session for its member. Login and
all Church-owned capabilities remain denied until an explicitly implemented
resumption operation restores a consistent active state.

The current provisioning slice defines this operational requirement but does
not expose a manual database procedure. Session revocation and suspension UI are
completed in the authentication lifecycle Issues before production release.

## Safe records

Record only the internal operator ID, capability, target Church/User IDs,
outcome category, request ID, and timestamp. Never record names, email addresses,
passwords, cookies, authorization headers, session tokens, request bodies, or
raw exception messages in diagnostic or audit events.
