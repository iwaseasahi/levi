import { hashPassword } from "better-auth/crypto";

interface AdminPasswordHashCommandDependencies {
  arguments: string[];
  hash(password: string): Promise<string>;
  inputIsTTY: boolean;
  outputIsTTY: boolean;
  promptSecret(label: string): Promise<string>;
  write(message: string): void;
}

function validPassword(password: string) {
  const length = [...password].length;
  return length >= 12 && length <= 128;
}

export async function runAdminPasswordHashCommand(
  overrides: Partial<AdminPasswordHashCommandDependencies> = {},
) {
  const dependencies: AdminPasswordHashCommandDependencies = {
    arguments: [],
    hash: hashPassword,
    inputIsTTY: false,
    outputIsTTY: false,
    promptSecret: async () => "",
    write: () => undefined,
    ...overrides,
  };

  if (
    !dependencies.inputIsTTY ||
    !dependencies.outputIsTTY ||
    dependencies.arguments.length !== 0
  ) {
    dependencies.write("対話式ターミナルから引数なしで実行してください。\n");
    return 1;
  }

  try {
    const password = await dependencies.promptSecret("管理画面用パスワード: ");
    const confirmation =
      await dependencies.promptSecret("管理画面用パスワード（確認）: ");
    if (!validPassword(password)) {
      dependencies.write("パスワードは12〜128文字で入力してください。\n");
      return 1;
    }
    if (password !== confirmation) {
      dependencies.write("確認用パスワードが一致しません。\n");
      return 1;
    }

    const passwordHash = await dependencies.hash(password);
    dependencies.write(`ADMIN_BASIC_AUTH_PASSWORD_HASH=${passwordHash}\n`);
    return 0;
  } catch {
    dependencies.write("パスワードハッシュを生成できませんでした。\n");
    return 1;
  }
}
