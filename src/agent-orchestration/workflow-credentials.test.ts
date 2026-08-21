import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("agent workflow credential scope", () => {
  it("exposes provider secrets only to their exact CLI invocation steps", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/agent-orchestration.yml"),
      "utf8",
    );
    const lines = workflow.split("\n");
    const secretLines = lines.filter(
      (line) =>
        line.includes("secrets.CODEX_API_KEY") ||
        line.includes("secrets.ANTHROPIC_API_KEY"),
    );

    expect(secretLines).toHaveLength(4);
    expect(secretLines).toEqual(
      expect.arrayContaining([
        "          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}",
        "          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}",
      ]),
    );
    expect(secretLines.every((line) => line.startsWith("          "))).toBe(
      true,
    );
    expect(workflow).not.toMatch(/^ {0,8}(?:CODEX|ANTHROPIC)_API_KEY:/m);
    for (const secretLine of secretLines) {
      const index = lines.indexOf(secretLine);
      expect(lines[index - 1]).toBe("        env:");
      expect(lines[index + 1]).toMatch(/^ {8}run: [|>]-?$/);
    }
    expect(workflow).not.toMatch(
      /(?:CODEX|ANTHROPIC)_API_KEY:[^\n]*\n {8}run:[^\n]*\n(?: {10}[^\n]*\n)* {10}pnpm agent:run/,
    );
    expect(workflow).not.toContain('--tools "Read,Grep,Glob,Bash"');
  });

  it("uses reproducible Claude bare mode and filters keys from Codex shells", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/agent-orchestration.yml"),
      "utf8",
    );

    expect(workflow).toContain("claude --bare --print");
    expect(workflow).toContain(
      'shell_environment_policy.filters={CODEX_API_KEY="exclude",OPENAI_API_KEY="exclude",ANTHROPIC_API_KEY="exclude"}',
    );
  });
});
