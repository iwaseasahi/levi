import { execFile as execFileCallback } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const execFile = promisify(execFileCallback);

describe("local subscription agent policy", () => {
  it("does not expose a provider-backed GitHub Actions workflow", async () => {
    await expect(
      access(
        path.join(repositoryRoot, ".github/workflows/agent-orchestration.yml"),
      ),
    ).rejects.toThrow();
  });

  it("keeps package scripts limited to local handoff primitives", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(
      Object.keys(packageJson.scripts).filter((name) =>
        name.startsWith("agent:"),
      ),
    ).toEqual(["agent:checkpoint", "agent:checkpoint:verify", "agent:lease"]);
    expect(JSON.stringify(packageJson.scripts)).not.toMatch(
      /codex exec|claude\s+--|agent:(?:run|normalize|route)/,
    );
  });

  it("does not pass provider API keys or invoke provider CLIs in automation", async () => {
    const { stdout } = await execFile("git", ["ls-files", "-z"], {
      cwd: repositoryRoot,
      encoding: "buffer",
    });
    const files = stdout
      .toString("utf8")
      .split("\0")
      .filter(
        (file) =>
          file.length > 0 &&
          !file.startsWith("docs/") &&
          !file.endsWith(".md") &&
          file !== "src/agent-orchestration/local-policy.test.ts",
      )
      .map((file) => path.join(repositoryRoot, file));
    const contents = await Promise.all(
      files.map((file) => readFile(file, "utf8")),
    );

    expect(contents.join("\n")).not.toMatch(
      /(?:OPENAI|CODEX|ANTHROPIC)_API_KEY|ANTHROPIC_AUTH_TOKEN|(?:OPENAI|ANTHROPIC)_BASE_URL|CLAUDE_CODE_USE_(?:BEDROCK|VERTEX|FOUNDRY)|anthropics\/claude-code-action|@anthropic-ai\/claude-code|api\.(?:anthropic|openai)\.com|codex\s+(?:exec|login\s+--with-api-key)|claude\s+(?:-p|--print|setup-token)/,
    );
  });
});
