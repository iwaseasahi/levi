import { describe, expect, it } from "vitest";

import { classifyAgentFailure, shouldFallback } from "./classify";

describe("classifyAgentFailure", () => {
  it.each([
    [
      "You have reached your usage limit; reset at 08:00",
      "usage_limit_reached",
    ],
    ["HTTP 429: too many requests", "rate_limited_transient"],
    ["invalid API key", "authentication_failed"],
    ["permission denied", "permission_blocked"],
    ["request blocked by safety policy", "policy_blocked"],
    ["connect ETIMEDOUT", "infrastructure_failed"],
    ["unexpected process error", "agent_failed"],
  ])("classifies %s", (output, expected) => {
    expect(classifyAgentFailure({ exitCode: 1, output })).toBe(expected);
  });

  it("keeps authentication and verification-like failures out of fallback", () => {
    expect(shouldFallback("authentication_failed", 3)).toBe(false);
    expect(shouldFallback("agent_failed", 3)).toBe(false);
  });

  it("falls back immediately for a usage cap and after bounded transient retries", () => {
    expect(shouldFallback("usage_limit_reached", 1)).toBe(true);
    expect(shouldFallback("rate_limited_transient", 2)).toBe(false);
    expect(shouldFallback("rate_limited_transient", 3)).toBe(true);
  });
});
