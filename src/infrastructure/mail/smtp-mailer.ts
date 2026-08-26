import nodemailer from "nodemailer";

import { getMailRuntimeConfig } from "@/config/env";

export interface PasswordResetMail {
  name: string;
  resetUrl: string;
  to: string;
}

export async function sendAdminPasswordResetMail(input: PasswordResetMail) {
  const config = getMailRuntimeConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user
      ? { auth: { user: config.user, pass: config.password } }
      : {}),
  });
  await transport.sendMail({
    from: config.from,
    to: input.to,
    subject: "Levi 管理者パスワードの設定・再設定",
    text: [
      `${input.name} 様`,
      "",
      "Levi管理画面のパスワードを設定または再設定するには、次のURLを開いてください。",
      input.resetUrl,
      "",
      "このURLの有効期限は24時間です。心当たりがない場合は、このメールを破棄してください。",
    ].join("\n"),
  });
}
