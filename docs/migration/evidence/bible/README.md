# Bible migration evidence

This directory contains reviewed, anonymous summaries of authorized local
migration rehearsals. The source dump and full transient reports remain outside
the repository under operator control.

- Source type: product-owner-approved Ginmaku MySQL dump.
- Generator: `pnpm migration:bible:rehearse`.
- Normalization: strict UTF-8 MySQL escape decoding; no text repair, trimming,
  renumbering, or omission.
- Permitted evidence: counts, versions, booleans, durations, and SHA-256
  fingerprints only.
- Prohibited evidence: Bible text, credentials, personal data, hostnames, and
  production connection details.
- Coverage: Issue #56 clean import, injected failure rollback, exact rerun,
  backup restore, and restored reconciliation.
