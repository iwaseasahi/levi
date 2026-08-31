import { z } from "zod";
import { scriptureBookCodeSchema } from "./identifiers";

const schema = z
  .object({
    location: z
      .object({
        book: scriptureBookCodeSchema,
        chapter: z.number().int().min(1).max(32767),
        verse: z.number().int().min(0).max(32767),
      })
      .strict()
      .nullable(),
  })
  .strict();
export function parseScriptureProjectionState(value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
