# Migration evidence policy

Evidence must be reproducible, licensed for project use, synthetic or approved
anonymized, and free of secrets and personal/production data.

## Storage

- Semantic golden masters: `tests/fixtures/migration/<slice>/` as reviewed UTF-8
  JSON/text with provenance metadata and stable ordering.
- Migration fixtures: the same subtree, generated from documented synthetic
  factories or an approved anonymization process; never from an ad hoc dump.
- Parity E2E: `tests/e2e/legacy-parity/` with scenario IDs matching the matrix.
- Durable visual evidence: `docs/migration/evidence/<slice>/` only when content
  ownership and privacy review permit committing it.
- Transient screenshots, videos, and traces: CI artifacts with retention defined
  in `docs/ci.md`; link the run from the matrix or PR.

Each fixture or golden-master directory needs a `README.md` recording source
type, generator, normalization, encoding, timezone, permitted use, and the matrix
IDs it proves. Hash source artifacts before transformation; do not commit a hash
if even its filename or metadata exposes sensitive information.

## Capture and comparison

- Prefer structured outputs, DOM/accessibility assertions, and behavior events to
  pixel snapshots. Screenshots supplement, but do not replace, semantic checks.
- Normalize line endings explicitly. Preserve meaningful whitespace in song and
  slide page delimiters and test it byte-for-byte where required.
- Remove clocks, random IDs, hostnames, and ordering ambiguity at fixture creation
  rather than masking broad snapshot regions.
- A golden master captures observed legacy behavior, not automatically desired
  behavior. Product acceptance decides whether Levi matches or deliberately
  diverges.

If a legacy runtime is unavailable, record `blocked` and use source-derived
fixtures only as hypotheses. Never label them runtime golden masters.
