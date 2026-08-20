import { describe, expect, it } from "vitest";

import { providerCommand } from "./commands";

describe("providerCommand", () => {
  it("uses explicit writable sandboxing and JSONL for Codex", () => {
    expect(providerCommand({ provider: "codex", workspace: "/repo" })).toEqual({
      executable: "codex",
      args: [
        "exec",
        "--sandbox",
        "workspace-write",
        "--ephemeral",
        "--json",
        "--cd",
        "/repo",
        "-",
      ],
    });
  });

  it("uses ephemeral non-interactive output and bounds Claude spend", () => {
    const command = providerCommand({
      provider: "claude",
      workspace: "/repo",
      maxBudgetUsd: 25,
    });
    expect(command.args).toContain("--no-session-persistence");
    expect(command.args).toContain("--max-budget-usd");
    expect(command.args).toContain("25");
  });
});
