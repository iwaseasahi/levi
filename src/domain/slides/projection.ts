import { z } from "zod";
import { SlideInputError } from "./slide";

const querySchema = z
  .object({
    id: z.uuid(),
  })
  .strict();
export function parseSlideProjectionQuery(value: unknown) {
  const result = querySchema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}
const schema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().min(1).max(2_147_483_647).nullable(),
    page: z.literal(0).nullable(),
    pageCount: z.union([z.literal(0), z.literal(1)]),
    status: z.enum(["loading", "ready", "stale", "unavailable"]),
  })
  .strict()
  .refine((value) =>
    value.status === "ready"
      ? value.revision !== null && value.page === 0 && value.pageCount === 1
      : value.page === null && value.pageCount === 0,
  );
export type SlideProjectionState = z.infer<typeof schema>;
export function parseSlideProjectionState(value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
export type SlideAudienceState =
  | { status: "ready"; text: string; revision: number }
  | {
      status: Exclude<SlideProjectionState["status"], "ready">;
      text: null;
      revision: number | null;
    };
export function slideProjectionState(
  id: string,
  state: SlideAudienceState,
): SlideProjectionState {
  return {
    id,
    status: state.status,
    revision: state.revision,
    page: state.status === "ready" ? 0 : null,
    pageCount: state.status === "ready" ? 1 : 0,
  };
}
export const slideAudienceMessages = {
  invalid: "スライドを表示できません。操作画面で再度Openしてください。",
  stale:
    "スライドが更新されました。操作画面で最新の内容を読み込み、再度Openしてください。",
  unavailable: "スライドを利用できません。操作画面で再度Openしてください。",
} as const;
