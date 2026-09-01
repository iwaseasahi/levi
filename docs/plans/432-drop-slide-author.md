# Remove Slide author attribution

- Issue #432; branch `codex/issue-432`.
- The forward migration permanently discards any existing `slides.author` values.
- Production migration and deployment remain separately approval-gated.

## Plan

1. [x] Trace author through the UI, domain, API, repositories, schema and tests.
2. [x] Remove author from the complete Slide contract and add a forward column
       removal migration without editing migration history.
3. [x] Update regression, schema, integration and Chromium evidence while
       preserving title/body, tenant, bookmark and projection behavior.
4. [ ] Run database and canonical checks, open a PR and verify exact-head CI
       before merge.

No dependency, legacy import or production operation is required.
