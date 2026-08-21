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
    expect(workflow).not.toContain(
      'pnpm add --global "@anthropic-ai/claude-code@${CLAUDE_CLI_VERSION}"',
    );
    expect(
      workflow.match(
        /curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash -s --/g,
      ),
    ).toHaveLength(2);
    expect(
      workflow.match(/"\$HOME\/\.local\/bin\/claude" --version/g),
    ).toHaveLength(2);
    expect(
      workflow.match(/sudo apt-get install --yes bubblewrap/g),
    ).toHaveLength(2);
    expect(workflow.match(/bwrap --version/g)).toHaveLength(2);
  });

  it("classifies failures portably, redacts diagnostics, and fails closed", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/agent-orchestration.yml"),
      "utf8",
    );

    expect(workflow).not.toContain("if rg -q");
    expect(workflow.match(/grep -Eqi/g)).toHaveLength(4);
    expect(workflow.match(/::stop-commands::%s/g)).toHaveLength(2);
    expect(workflow.match(/\[REDACTED_PROVIDER_SECRET\]/g)).toHaveLength(2);

    const codexUpload = workflow.indexOf("- name: Upload Codex checkpoint");
    const codexEnforcement = workflow.indexOf(
      "- name: Enforce terminal Codex result",
    );
    const claudeUpload = workflow.indexOf("- name: Upload Claude checkpoint");
    const claudeEnforcement = workflow.indexOf(
      "- name: Enforce successful Claude result",
    );

    expect(codexEnforcement).toBeGreaterThan(codexUpload);
    expect(claudeEnforcement).toBeGreaterThan(claudeUpload);
    expect(workflow).toContain("if: steps.route.outputs.fallback != 'true'");
    expect(workflow).toContain(
      'run: test "${{ steps.route.outputs.status }}" = succeeded',
    );
  });

  it("provides the repository CI database configuration to the quality gate", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/agent-orchestration.yml"),
      "utf8",
    );
    const qualityGate = workflow.slice(
      workflow.indexOf("  quality_gate:"),
      workflow.indexOf("  claude_review:"),
    );

    expect(qualityGate).toContain(
      "DATABASE_URL: postgresql://levi:levi@127.0.0.1:5432/levi_test?schema=public",
    );
    expect(qualityGate).toContain(
      "SHADOW_DATABASE_URL: postgresql://levi:levi@127.0.0.1:5432/levi_shadow?schema=public",
    );
  });
});
