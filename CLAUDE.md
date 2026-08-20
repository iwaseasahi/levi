@AGENTS.md

# Claude Code adapter

`AGENTS.md` is the repository-wide source of truth. This file exists only so
Claude Code loads that contract automatically. Provider-specific behavior must
not weaken governance, verification, credential, or approval boundaries.

- Claude-authored branches use `claude/issue-<number>`.
- In reviewer mode, do not edit files. Return findings with severity, file and
  line, evidence, and a proposed verification or remediation.
- Read a handoff manifest as a claim to verify: inspect the Issue, base SHA,
  diff, and recorded commands before continuing work.
