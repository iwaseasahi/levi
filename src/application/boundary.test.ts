import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("application dependency boundary", () => {
  it("does not import framework, infrastructure, Prisma, or Better Auth runtime", async () => {
    const root = path.resolve(process.cwd(), "src/application");
    const files = (await readdir(root, { recursive: true }))
      .filter(
        (file): file is string =>
          typeof file === "string" &&
          file.endsWith(".ts") &&
          !file.endsWith(".test.ts"),
      )
      .map((file) => path.join(root, file));
    const contents = await Promise.all(
      files.map((file) => readFile(file, "utf8")),
    );

    expect(contents.join("\n")).not.toMatch(
      /from ["'](?:@\/generated\/prisma|@\/infrastructure|better-auth|next\/)/,
    );
  });
});
