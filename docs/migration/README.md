# Ginmaku migration discovery

This directory tracks verifiable parity between legacy Ginmaku and Levi. It is
an investigation record, not permission to access production systems or data.

## Legacy sources and access

The confirmed source is the public repository
[`iwaseasahi/ginmaku`](https://github.com/iwaseasahi/ginmaku), default branch
`master`. The initial inventory was taken read-only at commit
`4b18adb02ac8011630c76137c60038e168f05534` (2024-03-28).

Reproduce the source inspection without running the legacy application:

```bash
git clone --depth 1 https://github.com/iwaseasahi/ginmaku.git /tmp/ginmaku
git -C /tmp/ginmaku rev-parse HEAD
rg --files /tmp/ginmaku
```

Inspect routes, migrations, models, controllers, views, JavaScript, tests, and
environment-variable names. Do not print or copy `config/database.yml`, local
`.env` files, credentials, database dumps, logs, or user-created content.

The following sources are currently unavailable and are explicit blockers to
claiming behavioral or data parity:

- a running legacy environment and supported access procedure;
- approved synthetic/anonymized representative exports;
- operator walkthroughs, supported browsers/projector topology, and runbooks;
- licensing/provenance for Bible text, song lyrics, PDFs, and other content;
- the shared ChatGPT conversation body (only its public title was retrievable).

Source inspection may establish **observed-in-code** behavior only. It cannot
establish current production usage, data shape, business priority, or permission
to migrate content. Add those claims only with an owner, dated evidence, and an
approved access path.

## Discovery workflow

1. Pin the legacy commit or artifact and record its provenance.
2. Copy [`inventory-template.md`](inventory-template.md) for each surface.
3. Add or refine rows in [`parity-matrix.md`](parity-matrix.md); never overwrite
   conflicting evidence without recording the conflict.
4. Capture approved evidence using [`evidence-policy.md`](evidence-policy.md).
5. For data-bearing slices, complete
   [`data-migration-plan-template.md`](data-migration-plan-template.md) and
   rehearse only with synthetic or explicitly approved anonymized fixtures.
6. Score candidate vertical slices in
   [`vertical-slice-candidates.md`](vertical-slice-candidates.md).
7. Before cutover implementation, turn
   [`cutover-strategy-options.md`](cutover-strategy-options.md) into an accepted
   ADR with product and operational evidence.

## Status vocabulary

- `observed`: supported by pinned legacy source or approved runtime evidence.
- `unverified`: plausible but missing primary evidence.
- `not-started`, `in-progress`, `blocked`, `verified`: Levi delivery status.
- `must`, `should`, `won't`: migration priority. `won't` needs a reason and owner;
  it does not mean the legacy behavior never existed.

No row is parity-complete until its acceptance criterion and evidence artifact
are both present and the Levi status is `verified`.
