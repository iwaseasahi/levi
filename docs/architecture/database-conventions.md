# Database conventions

These rules apply until a later accepted ADR deliberately changes them.

ADR 0007 and its
[`data-model-dictionary.md`](data-model-dictionary.md) specialize these rules for
Levi's identity, tenancy, Bible, Folder, and Bookmark models.

- Store timestamps as PostgreSQL `timestamptz` in UTC. Convert only at display
  boundaries; never store a local timezone as if it were UTC.
- Use UUID identifiers for durable domain records. Fixtures and seeds use fixed,
  recognizable UUIDs so repeated runs are deterministic.
- Model absence with nullable columns only when absence has domain meaning. Do
  not use empty strings, zero values, or sentinel dates as substitutes for null.
- Prefer restrictive foreign keys. Cascading delete requires an explicit
  aggregate-ownership decision and a test proving the intended deletion scope.
- Use hard deletion by default for replaceable configuration. Introduce soft
  deletion only when recovery, audit, or retention requirements are documented.
- Keep Prisma access under `src/infrastructure/database`; UI code must not create
  clients or own transaction boundaries.
- Migration SQL is immutable after merge. Correct released migrations with a new
  migration and rehearse destructive or locking changes against representative
  synthetic data.

Database resets are intentionally limited to the local `levi` and `levi_test`
databases on loopback hosts. Production and remote URLs fail closed.
