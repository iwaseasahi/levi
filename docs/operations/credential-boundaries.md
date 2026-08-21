# Credential boundaries

| Environment               | Permitted credentials                                                                                                          | Agent access                                                                        | Storage and use                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local development/test    | Disposable loopback PostgreSQL values from `.env.example`; local Codex/Claude subscription login stored outside the repository | Repository-scoped agent may use only the in-scope disposable database value         | Ignored `.env`; provider login remains in the user-owned client configuration; never commit/log/copy into PR     |
| CI verification           | Ephemeral service credentials and read-only GitHub token; no model-provider API key                                            | Test job only; no production network, provider invocation, or deployment identity   | Workflow `env`/service config                                                                                    |
| Production deploy/runtime | Deployment identity, DB, Better Auth secret rotation set, encryption, monitoring, backup credentials                           | Not available to normal Codex/Claude tasks, PR CI, forks, or dependency-update jobs | Protected GitHub Environment/approved secret manager; least privilege and audited human-approved deployment only |

Never reuse a credential across these boundaries. Production workflows must be
separate from PR verification and use environment protection plus minimal job
permissions. Agent code-generation jobs should not hold write/deploy credentials.

The Better Auth secret is an application runtime secret, not a Codex or Claude
Code credential. Its creation, rotation, and production injection require an
exact human-approved operation. Local and CI authentication tests use only a
synthetic secret. The initial release has no transactional-email credential.

If exposure is suspected, stop copying the value, preserve only redacted
evidence, notify the human security owner, identify scope from provider audit
logs, and request an approved rotation/revocation. Secret creation, access
changes, and rotation always require human approval.
