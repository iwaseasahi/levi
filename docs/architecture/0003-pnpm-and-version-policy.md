# ADR 0003: Use pnpm with explicit version pinning

- Status: accepted
- Date: 2026-08-21
- Decision owners: repository owner and architecture maintainers
- Supersedes: none
- Superseded by: none

## Context

Autonomous development requires deterministic dependency installation locally,
in worktrees, and in CI. The package manager and runtime must not vary silently
between agent environments.

## Decision

Use pnpm as the JavaScript package manager. Pin the expected pnpm release through
the `packageManager` field and repository tooling, pin the Node.js runtime, and
commit `pnpm-lock.yaml`.

CI and clean-install verification must use a frozen lockfile. Dependency updates
must be explicit pull requests and pass the same quality gate as application
changes.

## Consequences

### Positive

- Local, worktree, and CI installs share one dependency graph.
- Strict dependency resolution exposes undeclared imports.
- The lockfile gives agents and reviewers a concrete dependency diff.

### Negative and risks

- Contributors and runners need a compatible pnpm installation.
- Some packages with incorrect dependency declarations may need explicit fixes.
- Runtime and package-manager upgrades require coordinated changes.

## Alternatives considered

### npm

npm is widely available with Node.js, but it was not selected because pnpm is
already the project baseline and offers stricter dependency isolation and
efficient worktree installs.

### Yarn or Bun

Both can manage dependencies, but adding another runtime or package-manager
choice provides no demonstrated benefit for the initial stack.

## Compatibility and version policy

- Use an Active LTS Node.js version supported by the selected Prisma release.
- Pin exact toolchain versions in repository-controlled configuration.
- Use semver ranges only where compatible updates are intended; the lockfile
  remains the resolved source of truth.
- Upgrade one major toolchain component at a time unless compatibility requires
  a coordinated change.

## Reconsider when

- A supported deployment platform cannot run the pinned toolchain.
- Reproducibility or security requirements are better met by another package
  manager with measured evidence.

## Verification

- A clean environment installs with the frozen lockfile.
- Changing `package.json` without updating the lockfile fails CI.
- Local and CI quality gates invoke package scripts through pnpm.

## References

- [pnpm documentation](https://pnpm.io/)
- [Prisma ORM system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)

