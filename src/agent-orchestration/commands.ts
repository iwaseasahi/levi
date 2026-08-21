import type { Provider } from "./types";

export interface ProviderCommand {
  executable: string;
  args: string[];
}

export function providerCommand(input: {
  provider: Provider;
  workspace: string;
  model?: string;
  maxBudgetUsd?: number;
}): ProviderCommand {
  if (input.provider === "codex") {
    return {
      executable: "codex",
      args: [
        "exec",
        "--sandbox",
        "workspace-write",
        "--ephemeral",
        "--ignore-user-config",
        "--strict-config",
        "--json",
        "--config",
        'shell_environment_policy.filters={CODEX_API_KEY="exclude",OPENAI_API_KEY="exclude",ANTHROPIC_API_KEY="exclude"}',
        "--cd",
        input.workspace,
        ...(input.model ? ["--model", input.model] : []),
        "-",
      ],
    };
  }

  return {
    executable: "claude",
    args: [
      "--print",
      "--bare",
      "--output-format",
      "json",
      "--permission-mode",
      "acceptEdits",
      "--no-session-persistence",
      ...(input.model ? ["--model", input.model] : []),
      ...(input.maxBudgetUsd
        ? ["--max-budget-usd", String(input.maxBudgetUsd)]
        : []),
    ],
  };
}
