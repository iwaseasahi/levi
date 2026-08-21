import { z } from "zod";

const provisioningInputSchema = z.object({
  churchName: z
    .string()
    .trim()
    .min(1, "教会名を入力してください。")
    .max(200, "教会名は200文字以内で入力してください。"),
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

export type ProvisioningInput = z.infer<typeof provisioningInputSchema>;
export type ProvisioningField = keyof ProvisioningInput;
export type ProvisioningFieldErrors = Partial<
  Record<ProvisioningField, string[]>
>;

export type ProvisioningInputResult =
  | { data: ProvisioningInput; success: true }
  | { errors: ProvisioningFieldErrors; success: false };

export function parseProvisioningInput(input: {
  accountName: unknown;
  churchName: unknown;
  email: unknown;
}): ProvisioningInputResult {
  const result = provisioningInputSchema.safeParse(input);

  if (result.success) {
    return { data: result.data, success: true };
  }

  return {
    errors: result.error.flatten().fieldErrors,
    success: false,
  };
}
