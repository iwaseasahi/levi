import { z } from "zod";

export const projectionSchema = "levi.projection" as const;
export const projectionVersion = 1 as const;

export type ProjectionControlState = {
  blank: boolean;
  currentIndex: number;
  fontScale: number;
  scrollDirection: "up" | "down" | null;
  scrollRevision: number;
};

export type ProjectionControlEvent =
  | { type: "previous" }
  | { type: "next" }
  | { type: "select"; index: number }
  | { type: "font-smaller" }
  | { type: "font-larger" }
  | { type: "scroll"; direction: "up" | "down" }
  | { type: "toggle-blank" };

export const initialProjectionControlState: ProjectionControlState = {
  blank: false,
  currentIndex: 0,
  fontScale: 1,
  scrollDirection: null,
  scrollRevision: 0,
};

export function reduceProjectionControl(
  state: ProjectionControlState,
  event: ProjectionControlEvent,
  itemCount: number,
): ProjectionControlState {
  switch (event.type) {
    case "previous":
      return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) };
    case "next":
      return {
        ...state,
        currentIndex: Math.min(
          Math.max(0, itemCount - 1),
          state.currentIndex + 1,
        ),
      };
    case "select":
      return event.index >= 0 && event.index < itemCount
        ? { ...state, currentIndex: event.index }
        : state;
    case "font-smaller":
      return { ...state, fontScale: Math.max(0.6, state.fontScale - 0.1) };
    case "font-larger":
      return { ...state, fontScale: Math.min(2.2, state.fontScale + 0.1) };
    case "scroll":
      return {
        ...state,
        scrollDirection: event.direction,
        scrollRevision: state.scrollRevision + 1,
      };
    case "toggle-blank":
      return { ...state, blank: !state.blank };
  }
}

export type AudienceConnection =
  "closed" | "opening" | "connected" | "disconnected" | "blocked";

export function reduceAudienceConnection(
  state: AudienceConnection,
  event: "open" | "ready" | "blocked" | "closed" | "timeout",
): AudienceConnection {
  if (event === "open") return "opening";
  if (event === "blocked") return "blocked";
  if (event === "closed") return "closed";
  if (event === "ready") return "connected";
  return state === "connected" || state === "opening" ? "disconnected" : state;
}

const envelope = {
  schema: z.literal(projectionSchema),
  version: z.literal(projectionVersion),
};

const audienceStateSchema = z
  .object({
    blank: z.boolean(),
    fontScale: z.number().min(0.6).max(2.2),
    reference: z.string().min(1).max(200),
    revision: z.number().int().nonnegative(),
    scrollDirection: z.enum(["up", "down"]).nullable(),
    scrollRevision: z.number().int().nonnegative(),
    sessionId: z.uuid(),
    translations: z
      .array(
        z
          .object({
            language: z.enum(["ja", "en"]),
            name: z.string().min(1).max(200),
            text: z.string(),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();

const controllerMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...envelope,
      type: z.literal("STATE"),
      payload: audienceStateSchema,
    })
    .strict(),
  z
    .object({ ...envelope, type: z.literal("PING"), sessionId: z.uuid() })
    .strict(),
  z
    .object({ ...envelope, type: z.literal("CLEAR"), sessionId: z.uuid() })
    .strict(),
]);

const audienceMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("READY") }).strict(),
  z
    .object({ ...envelope, type: z.literal("PONG"), sessionId: z.uuid() })
    .strict(),
]);

export type ControllerProjectionMessage = z.infer<
  typeof controllerMessageSchema
>;
export type AudienceProjectionMessage = z.infer<typeof audienceMessageSchema>;
export type AudienceProjectionState = z.infer<typeof audienceStateSchema>;

export function parseControllerProjectionMessage(value: unknown) {
  const result = controllerMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAudienceProjectionMessage(value: unknown) {
  const result = audienceMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function isTrustedProjectionEvent(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
) {
  return event.origin === expectedOrigin && event.source === expectedSource;
}
