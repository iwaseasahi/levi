import { z } from "zod";

const schema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email("有効なメールアドレスを入力してください。"))
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
