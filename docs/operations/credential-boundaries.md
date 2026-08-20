# Credential boundaries

| Environment               | Permitted credentials                                                                                                      | Agent access                                                                        | Storage and use                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local development/test    | Disposable loopback PostgreSQL values from `.env.example`; revocable provider sandbox token only when an Issue requires it | Repository-scoped agent may use only the in-scope disposable value                  | Ignored `.env`; never commit/log/copy into PR                                                                    |
| CI verification           | Ephemeral service credentials and read-only GitHub token                                                                   | Test job only; no production network or deployment identity                         | Workflow `env`/service config or approved CI secret for a specific sandbox                                       |
| Production deploy/runtime | Deployment identity, DB, auth, encryption, monitoring, backup credentials                                                  | Not available to normal Codex/Claude tasks, PR CI, forks, or dependency-update jobs | Protected GitHub Environment/approved secret manager; least privilege and audited human-approved deployment only |

Never reuse a credential across these boundaries. Production workflows must be
separate from PR verification and use environment protection plus minimal job
permissions. Agent code-generation jobs should not hold write/deploy credentials.

If exposure is suspected, stop copying the value, preserve only redacted
evidence, notify the human security owner, identify scope from provider audit
logs, and request an approved rotation/revocation. Secret creation, access
changes, and rotation always require human approval.
