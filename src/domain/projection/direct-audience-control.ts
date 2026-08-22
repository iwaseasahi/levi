import { z } from "zod";

export const directAudienceSchema = "levi.direct-audience" as const;
export const directAudienceVersion = 1 as const;

const envelope = {
  schema: z.literal(directAudienceSchema),
  version: z.literal(directAudienceVersion),
};

const directAudienceCommandSchema = z
  .object({
    ...envelope,
    action: z.enum([
      "font-larger",
      "font-smaller",
      "previous",
      "next",
      "toggle-blank",
    ]),
    type: z.literal("CONTROL"),
  })
  .strict();

const directAudienceReadySchema = z
  .object({
    ...envelope,
    type: z.literal("READY"),
  })
  .strict();

export type DirectAudienceCommand = z.infer<typeof directAudienceCommandSchema>;
export type DirectAudienceReady = z.infer<typeof directAudienceReadySchema>;

export function parseDirectAudienceCommand(value: unknown) {
  const result = directAudienceCommandSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseDirectAudienceReady(value: unknown) {
  const result = directAudienceReadySchema.safeParse(value);
  return result.success ? result.data : null;
}

export function isTrustedDirectAudienceEvent(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
) {
  return event.origin === expectedOrigin && event.source === expectedSource;
}
