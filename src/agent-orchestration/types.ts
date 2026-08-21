export const agentStatuses = [
  "succeeded",
  "rate_limited_transient",
  "usage_limit_reached",
  "authentication_failed",
  "permission_blocked",
  "policy_blocked",
  "verification_failed",
  "agent_failed",
  "infrastructure_failed",
  "needs_human_decision",
] as const;

export type AgentStatus = (typeof agentStatuses)[number];
export type Provider = "codex";

export interface VerificationRecord {
  command: string;
  status: "passed" | "failed" | "not_run";
  summary: string;
}

export interface HandoffManifest {
  schema_version: 1;
  issue: number;
  run_id: string;
  provider: Provider;
  model: string | null;
  base_sha: string;
  branch: string;
  worktree: string;
  created_at: string;
  completed_steps: string[];
  changed_files: string[];
  verification: VerificationRecord[];
  remaining_work: string[];
  blocker: AgentStatus | null;
  switch_reason: string | null;
  retry_after: string | null;
  patch_sha256: string | null;
}

export interface WriterLease {
  schema_version: 1;
  issue: number;
  run_id: string;
  provider: Provider;
  branch: string;
  acquired_at: string;
  expires_at: string;
}
