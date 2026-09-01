import { z } from "zod";
import { SlideInputError } from "./slide";

const page = z.number().int().min(0).max(24_999);
const querySchema = z
  .object({
    id: z.uuid(),
  })
  .strict()
  .transform(({ id }) => ({ id, page: 0 }));
export function parseSlideProjectionQuery(value: unknown) {
  const result = querySchema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}
const schema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().min(1).max(2_147_483_647).nullable(),
    page: page.nullable(),
    pageCount: z.number().int().min(0).max(25_000),
    status: z.enum(["loading", "ready", "invalid", "stale", "unavailable"]),
  })
  .strict()
  .refine((value) =>
    value.status === "ready"
      ? value.revision !== null &&
        value.page !== null &&
        value.page < value.pageCount
      : value.page === null && value.pageCount === 0,
  );
export type SlideProjectionState = z.infer<typeof schema>;
export function parseSlideProjectionState(value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
export type SlideAudienceState = {
  status: SlideProjectionState["status"];
  pages: string[];
  page: number;
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
    page: state.status === "ready" ? state.page : null,
    pageCount: state.status === "ready" ? state.pages.length : 0,
  };
}
export const slideAudienceMessages = {
  loading: "読み込み中…",
  ready: "",
  invalid: "スライドを表示できません。操作画面で再度Openしてください。",
  stale:
    "スライドが更新されました。操作画面で最新の内容を読み込み、再度Openしてください。",
  unavailable: "スライドを利用できません。操作画面で再度Openしてください。",
} as const;
