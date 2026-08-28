import { z } from "zod";

const invitationInputSchema = z.object({
  churchId: z.uuid("対象の教会が正しくありません。"),
  accountName: z
    .string()
    .trim()
    .min(1, "利用者名を入力してください。")
    .max(200, "利用者名は200文字以内で入力してください。"),
  email: z
    .string()
    .trim()
    .max(320, "メールアドレスは320文字以内で入力してください。")
    .pipe(z.email("有効なメールアドレスを入力してください。"))
    .transform((value) => value.toLowerCase()),
});

export type ChurchUserInvitationInput = z.infer<typeof invitationInputSchema>;
export type ChurchUserInvitationField = keyof ChurchUserInvitationInput;
export type ChurchUserInvitationFieldErrors = Partial<
  Record<ChurchUserInvitationField, string[]>
>;

export function parseChurchUserInvitationInput(input: {
  accountName: unknown;
  churchId: unknown;
  email: unknown;
}):
  | { data: ChurchUserInvitationInput; success: true }
  | { errors: ChurchUserInvitationFieldErrors; success: false } {
  const result = invitationInputSchema.safeParse(input);
  return result.success
    ? { data: result.data, success: true }
    : { errors: result.error.flatten().fieldErrors, success: false };
}
