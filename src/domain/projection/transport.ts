import { z } from "zod";

export const projectionSchema = "levi.direct-audience" as const;
export const projectionVersion = 2 as const;
export const projectionKind = z.enum(["scripture", "slide"]);
export type ProjectionKind = z.infer<typeof projectionKind>;
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const envelope = {
  schema: z.literal(projectionSchema),
  version: z.literal(projectionVersion),
  kind: projectionKind,
  generation: z.uuid(),
};
export const presentationSchema = z
  .object({
    ready: z.boolean(),
    authorized: z.boolean(),
    fontScale: z.number().min(0.6).max(2.2),
    blank: z.boolean(),
  })
  .strict();
export type PresentationState = z.infer<typeof presentationSchema>;
const state = {
  instance: z.uuid(),
  sequence,
  presentation: presentationSchema,
  content: z.unknown(),
};
const basicAction = z.enum([
  "previous",
  "next",
  "font-larger",
  "font-smaller",
  "toggle-blank",
]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: basicAction }).strict(),
  z
    .object({
      action: z.literal("select-page"),
      page: z.number().int().min(0).max(24_999),
    })
    .strict(),
]);
export type ProjectionAction = z.infer<typeof actionSchema>;
const messageSchema = z.discriminatedUnion("type", [
  z
    .object({ ...envelope, type: z.literal("HELLO"), instance: z.uuid() })
    .strict(),
  z
    .object({ ...envelope, type: z.literal("CONNECT"), challenge: z.uuid() })
    .strict(),
  z
    .object({
      ...envelope,
      ...state,
      type: z.literal("READY"),
      challenge: z.uuid(),
    })
    .strict(),
  z.object({ ...envelope, ...state, type: z.literal("ACK") }).strict(),
  z
    .object({
      ...envelope,
      type: z.literal("CONTROL"),
      instance: z.uuid(),
      sequence,
      command: actionSchema,
    })
    .strict(),
]);
export type ProjectionMessage = z.infer<typeof messageSchema>;
export function parseProjectionMessage(input: unknown) {
  const result = messageSchema.safeParse(input);
  return result.success ? result.data : null;
}
export function projectionEnvelope(kind: ProjectionKind, generation: string) {
  return {
    schema: projectionSchema,
    version: projectionVersion,
    kind,
    generation,
  };
}
export function projectionGeneration(hash: string) {
  const result = z
    .uuid()
    .safeParse(hash.startsWith("#levi=") ? hash.slice(6) : null);
  return result.success ? result.data : null;
}
export function trustedProjectionEvent(
  event: Pick<MessageEvent, "origin" | "source">,
  origin: string,
  source: MessageEventSource | null,
) {
  return source !== null && event.source === source && event.origin === origin;
}
export function projectionArrow(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "isComposing"
    | "altKey"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
    | "target"
  >,
  captureInputArrows = false,
): "previous" | "next" | null {
  if (
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return null;
  const target = event.target;
  if (
    !captureInputArrows &&
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable=false])",
    )
  )
    return null;
  return event.key === "ArrowUp"
    ? "previous"
    : event.key === "ArrowDown"
      ? "next"
      : null;
}
