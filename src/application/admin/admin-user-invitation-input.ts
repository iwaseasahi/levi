import { z } from "zod";

const schema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email("有効なメールアドレスを入力してください。"))
    .transform((value) => value.toLowerCase()),
  loginId: z
    .string()
    .trim()
    .min(3, "ログインIDは3文字以上で入力してください。")
    .max(100, "ログインIDは100文字以内で入力してください。")
    .regex(
      /^[a-zA-Z0-9._@-]+$/,
      "ログインIDは半角英数字と . _ @ - で入力してください。",
    )
    .transform((value) => value.toLowerCase()),
  name: z
    .string()
    .trim()
    .min(1, "管理者名を入力してください。")
    .max(200, "管理者名は200文字以内で入力してください。"),
});

export type AdminUserInvitationInput = z.infer<typeof schema>;
export type AdminUserInvitationFieldErrors = Partial<
  Record<keyof AdminUserInvitationInput, string[]>
>;

export function parseAdminUserInvitationInput(input: {
  email: unknown;
  loginId: unknown;
  name: unknown;
}) {
  const result = schema.safeParse(input);
  return result.success
    ? ({ data: result.data, success: true } as const)
    : ({
        errors: result.error.flatten().fieldErrors,
        success: false,
      } as const);
}
