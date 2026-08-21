import {
  BibleImportError,
  dryRunGinmakuBible,
  importGinmakuBible,
  reconcileGinmakuBible,
  validateGinmakuBibleDump,
} from "../src/migration/ginmaku-bible-import";

function options(values: string[]) {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new BibleImportError("CLI_INVALID_OPTION");
    result.set(key.slice(2), value);
  }
  return result;
}

const [mode, path, ...rawOptions] = process.argv.slice(2);
const allowedModes = new Set(["validate", "dry-run", "import", "reconcile"]);

try {
  if (!mode || !allowedModes.has(mode) || !path)
    throw new BibleImportError("CLI_USAGE");
  const parsedOptions = options(rawOptions);
  const source = await validateGinmakuBibleDump(path);
  if (mode === "validate") {
    if (parsedOptions.size) throw new BibleImportError("CLI_INVALID_OPTION");
    process.stdout.write(
      `${JSON.stringify({ mode, source: source.report }, null, 2)}\n`,
    );
  } else {
    const { prisma } = await import("../src/infrastructure/database/client");
    try {
      if (mode === "dry-run") {
        if (parsedOptions.size)
          throw new BibleImportError("CLI_INVALID_OPTION");
        const result = await dryRunGinmakuBible(prisma, source);
        process.stdout.write(
          `${JSON.stringify({ mode, ...result }, null, 2)}\n`,
        );
      } else if (mode === "reconcile") {
        if (parsedOptions.size)
          throw new BibleImportError("CLI_INVALID_OPTION");
        const result = await reconcileGinmakuBible(prisma, source);
        process.stdout.write(
          `${JSON.stringify({ mode, ...result }, null, 2)}\n`,
        );
        if (!result.exact) process.exitCode = 2;
      } else {
        const checksum = parsedOptions.get("confirm-source-sha");
        const batchSize = Number(parsedOptions.get("batch-size") ?? "500");
        if (
          !checksum ||
          checksum !== source.report.input.sha256 ||
          [...parsedOptions.keys()].some(
            (key) => key !== "confirm-source-sha" && key !== "batch-size",
          )
        )
          throw new BibleImportError("IMPORT_SOURCE_CONFIRMATION_REQUIRED");
        const result = await importGinmakuBible(prisma, source, { batchSize });
        process.stdout.write(
          `${JSON.stringify({ mode, ...result }, null, 2)}\n`,
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
} catch (error) {
  const code =
    error instanceof BibleImportError
      ? error.code
      : "IMPORT_UNEXPECTED_FAILURE";
  const count = error instanceof BibleImportError ? error.count : undefined;
  process.stderr.write(
    `${JSON.stringify({ error: code, ...(count === undefined ? {} : { count }) })}\n`,
  );
  process.exitCode = 1;
}
