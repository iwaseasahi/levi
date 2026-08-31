# Church account lifecycle runbook

This runbook covers the email-based Church account lifecycle. It
does not authorize production access, secret changes, deployment, or direct
production database mutation. Those actions retain the human approval gates in
`docs/governance/autonomy.md`.

## Before provisioning

1. Verify the Church contact and requested login email using the approved
   operator records.
2. Confirm that the recipient can receive email at that address.
3. Open the protected Levi operator page directly. Do not share the operator
   session or use a screen-sharing recording.
4. Enter the canonical Church name, recipient display name, and normalized login
   email. A repeated submission returns a generic failure and must not be treated
   as evidence that an account exists.

## Invitation and password setup

After a successful commit, Levi sends a single-use password-setup link to the
recipient. The link remains valid for 72 hours.

1. Confirm the administration screen reports that the invitation was accepted
   for delivery; do not treat this as proof that Gmail delivered it.
2. Ask the recipient to check the addressed mailbox and its spam folder.
3. The recipient opens the link and chooses a password known only to them.
4. Do not copy invitation links into Issues, pull requests, agent prompts,
   screenshots, recordings, ordinary notes, or logs.

## Lost, expired, or possibly exposed link

- Do not create a second Church or duplicate identity to work around an expired
  invitation.
- Treat a screenshot, message, recording, unintended observer, or uncertain
  sharing of a setup/reset link as exposure.
- The user requests a new link through `/forgot-password`; Levi returns the same
  generic response whether the identity exists or not.
- A valid replacement link remains usable for 72 hours. Successful reset revokes
  existing sessions.
- The platform operator does not issue or view a password. Never edit credential
  or verification rows directly.

## Suspension and resumption

Account suspension is a protected operator operation. It sets the Church to
`SUSPENDED` with a timestamp and revokes every session for its member. Login and
all Church-owned capabilities remain denied until an explicitly implemented
resumption operation restores a consistent active state.

The current provisioning slice defines this operational requirement but does
not expose a manual database procedure. Session revocation and suspension UI are
completed in the authentication lifecycle Issues before production release.

## Delete an individual Church user

An authenticated administrator opens `/admin/churches`, selects **利用者を削除**
for the intended member, and types that member's email in the confirmation
dialog. Both active members and pending invitees can be deleted. Cancel or
Escape closes the dialog without changing data (closing is disabled while the
request is pending).

The server rechecks the administrator, the Church membership, and the email in
one transaction. Deletion permanently removes the User, credential accounts,
all sessions, membership, and outstanding invitation/reset verification links.
Existing sessions and password links no longer authorize access. The Church,
shared folders/bookmarks, other users, administrator identities, and Bible data
remain unchanged. Deleting the last member leaves an empty Church; a new member
can subsequently be invited. This is not Church deletion or a recoverable
suspension. Any transaction failure rolls back the entire deletion.

## Safe records

Record only the internal operator ID, capability, target Church/User IDs,
outcome category, request ID, and timestamp. Never record names, email addresses,
passwords, cookies, authorization headers, session tokens, request bodies, or
raw exception messages in diagnostic or audit events.
