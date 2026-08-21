# Observability baseline

## Probes

- `GET /api/health` is liveness: the Next.js process can answer. It must not
  depend on PostgreSQL or external services.
- `GET /api/ready` is readiness: required dependencies currently include
  PostgreSQL. It returns 503 when the process should receive no new traffic.
- `GET /api/health/database` remains a focused diagnostic endpoint for local and
  operator checks; deployment health routing should use `/api/ready`.

All probe responses are `no-store`. A caller can mechanically validate readiness
with `pnpm readiness:check`. Probe endpoints must reveal only component status,
never connection strings, hostnames, query/error text, versions, or credentials.

## Structured logs and request tracing

Levi generates a new UUID `x-request-id` at its public application boundary,
forwards it to route code, returns it to the caller, and includes it in JSON log
events. Caller-provided IDs are not trusted. If a future trusted load balancer
owns trace IDs, document and test that trust boundary before preserving them.

Log events use stable, namespaced event names and allowlisted structured fields.
Do not log request/response bodies, query strings, authorization/cookie headers,
session/user tokens, credentials, connection URLs, free-form song/slide text,
personal/pastoral data, imported filenames, or raw exceptions. The logger
redacts sensitive **keys** as defense in depth; it does not make arbitrary values
safe. Prefer error class and stable internal code over an exception message.

Future audit logs are distinct from diagnostic logs. Authorization, content
mutation, export, and administrative actions require append-oriented records
with actor, capability, resource ID, outcome, request ID, and timestamp. Audit
retention, access, integrity, and privacy must be decided before implementation.

## Error monitoring

No production monitoring vendor is connected. Before one is selected, complete a
data-processing/privacy review, configure server-side filtering and environment
separation, set bounded retention, verify source-map access, and send a synthetic
error containing canary fake secrets/personal fields to prove scrubbing. Provider
credentials belong only to the protected deployment environment.

The initial-release signal thresholds, stop conditions, named human roles, and
stabilization responsibilities are defined in
[`initial-release-cutover.md`](initial-release-cutover.md). Issue
[#81](https://github.com/iwaseasahi/levi/issues/81) must select routing and
ownership and prove redaction with disposable canary data before production
events are sent to a monitoring provider.
