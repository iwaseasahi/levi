import type { AgentStatus } from "./types";

const matches = (value: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(value));

export function classifyAgentFailure(input: {
  exitCode: number | null;
  output: string;
  timedOut?: boolean;
}): AgentStatus {
  if (input.exitCode === 0) return "succeeded";
  if (input.timedOut) return "infrastructure_failed";

  const output = input.output.toLowerCase();

  if (
    matches(output, [
      /usage limit/,
      /quota (?:has been )?exceeded/,
      /credit balance/,
      /monthly limit/,
    ])
  ) {
    return "usage_limit_reached";
  }
  if (
    matches(output, [
      /\b429\b/,
      /rate[ _-]?limit/,
      /too many requests/,
      /overloaded/,
      /temporarily unavailable/,
    ])
  ) {
    return "rate_limited_transient";
  }
  if (
    matches(output, [
      /unauthenticated/,
      /authentication (?:failed|required)/,
      /invalid (?:api )?key/,
      /unauthorized/,
      /\b401\b/,
    ])
  ) {
    return "authentication_failed";
  }
  if (matches(output, [/permission denied/, /forbidden/, /access denied/])) {
    return "permission_blocked";
  }
  if (
    matches(output, [/policy (?:violation|blocked|denied)/, /safety policy/])
  ) {
    return "policy_blocked";
  }
  if (
    matches(output, [
      /econnreset/,
      /etimedout/,
      /could not resolve host/,
      /temporary failure in name resolution/,
    ])
  ) {
    return "infrastructure_failed";
  }
  return "agent_failed";
}

export function shouldFallback(status: AgentStatus, attempts: number): boolean {
  return (
    status === "usage_limit_reached" ||
    (status === "rate_limited_transient" && attempts >= 3)
  );
}
