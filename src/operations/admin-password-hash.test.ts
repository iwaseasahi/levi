import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";

import { runAdminPasswordHashCommand } from "./admin-password-hash";

function terminal(prompts: string[], write = vi.fn()) {
  return {
    inputIsTTY: true,
    outputIsTTY: true,
    promptSecret: vi.fn(async () => prompts.shift() ?? ""),
    write,
  };
}

describe("runAdminPasswordHashCommand", () => {
  it("refuses arguments and non-interactive input", async () => {
    const write = vi.fn();
    await expect(
      runAdminPasswordHashCommand({ arguments: ["plaintext"], write }),
    ).resolves.toBe(1);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("対話式"));
  });

  it("rejects a short or mismatched password", async () => {
    await expect(
      runAdminPasswordHashCommand(terminal(["short", "short"])),
    ).resolves.toBe(1);
    await expect(
      runAdminPasswordHashCommand(
        terminal(["first-password", "second-password"]),
      ),
    ).resolves.toBe(1);
  });

  it("prints a verifier without printing the plaintext password", async () => {
    const plaintext = "a-secure-admin-password";
    const write = vi.fn();
    await expect(
      runAdminPasswordHashCommand(terminal([plaintext, plaintext], write)),
    ).resolves.toBe(0);

    const output = write.mock.calls.join("");
    expect(output).not.toContain(plaintext);
    const hash = output.trim().split("=")[1];
    if (!hash) throw new Error("Expected a generated password hash");
    await expect(verifyPassword({ hash, password: plaintext })).resolves.toBe(
      true,
    );
  });
});
