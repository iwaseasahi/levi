# Incident runbook: <symptom or service>

## Ownership and scope

- Severity/impact:
- Incident commander:
- Technical owner:
- Affected environment/users/workflow:
- Start/detection time and request IDs:
- Data classification involved:

## Detect and triage

1. Check liveness and readiness without exposing response internals.
2. Correlate structured logs by trusted request ID and stable event/code.
3. Confirm deployment version, migration status, dependency/provider status, and
   last known-good time.
4. Preserve non-sensitive evidence; do not paste credentials, bodies, production
   records, or raw backups into Issues/chat.

## Contain

- Safe reversible containment:
- Traffic/write/read-only decision:
- Credential/data exposure assessment:
- Human approval required before production mutation, access change, secret
  rotation, restore, rollback, or external communication:

## Recover

- Selected rollback or forward-fix and reason:
- Backup/restore identifier and approval (if applicable):
- Commands/runbook references:
- Data reconciliation:
- Readiness and critical E2E evidence:

## Communicate

- Approved audience and owner:
- Update cadence:
- Facts/unknowns/next checkpoint:

Agents must not send incident communication outside the explicitly assigned
GitHub workflow without the required human approval.

## Close and learn

- End time and duration:
- Root cause and contributing controls:
- Detection/response/recovery gaps:
- Follow-up Issues with owners and due dates:
- Secret/data handling actions and evidence location:
- Runbook/test/guard updated:
