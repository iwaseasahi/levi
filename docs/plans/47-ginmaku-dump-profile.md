# Ginmaku dump profiling and mapping

## Issue

- Issue: #47
- Branch: `codex/issue-47`
- Base commit: `7e2714a`

## Outcome

The approved production dump has a reproducible, text-safe profile and an
explicit mapping to JSS3/NKJV and canonical books. Import stop conditions retain
every source row without silent repair.

## Plan

1. [x] Verify the approved file locally without modifying or copying it.
2. [x] Implement a text-safe parser/profiler and synthetic CI fixture.
3. [x] Profile schema, encoding, counts, NULL/empty, duplicates, gaps, versions,
       names, and anonymous fingerprints.
4. [x] Define typed translation/book mapping and record product decisions.
5. [ ] Run all quality gates and merge only the exact passing commit.

## Decisions

- Product owner confirmed Bible display rights on 2026-08-21.
- Legacy version 2 is NKJV, not the previously assumed KJV.
- Preserve all 62,325 `books` rows byte-for-value after SQL decoding, including
  five empty strings. Never silently skip or repair them.
- Real dump/text remains outside Git and CI; only synthetic text enters fixtures.

## Result

Local verification passed: production profile checksum/counts, empty-schema
migration reconstruction and drift, 52 unit tests, 10 component tests, 39
PostgreSQL integration tests, build, security audit/license policy, and
`git diff --check`. Exact-commit GitHub verification remains before merge.
