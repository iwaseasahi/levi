import nodemailer from "nodemailer";

import { getMailRuntimeConfig } from "@/config/env";
import { PASSWORD_LINK_VALIDITY_LABEL } from "@/config/password-link";

export interface PasswordResetMail {
  name: string;
  resetUrl: string;
  to: string;
}

export async function sendAdminPasswordResetMail(input: PasswordResetMail) {
  return sendPasswordResetMail(input, {
    instructions:
      "Levi管理画面のパスワードを再設定するには、次のURLを開いてください。",
    subject: "Levi 管理者パスワードの再設定",
  });
}

export async function sendChurchPasswordResetMail(input: PasswordResetMail) {
  return sendPasswordResetMail(input, {
    instructions:
      "Levi教会用画面のパスワードを再設定するには、次のURLを開いてください。",
    subject: "Levi 教会利用者パスワードの再設定",
  });
}

export async function sendAdminPasswordSetupMail(input: PasswordResetMail) {
  return sendPasswordResetMail(input, {
    instructions:
      "Levi管理画面に招待されました。初回パスワードを設定するには、次のURLを開いてください。",
    subject: "Levi 管理者パスワードの設定",
  });
}

export async function sendChurchPasswordSetupMail(input: PasswordResetMail) {
  return sendPasswordResetMail(input, {
    instructions:
      "Levi教会用画面に招待されました。初回パスワードを設定するには、次のURLを開いてください。",
    subject: "Levi 教会利用者パスワードの設定",
  });
}

async function sendPasswordResetMail(
  input: PasswordResetMail,
  copy: { instructions: string; subject: string },
) {
  const config = getMailRuntimeConfig();
  if (config.deliveryMode === "discard") return;

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
    subject: copy.subject,
    text: [
      `${input.name} 様`,
      "",
      copy.instructions,
      input.resetUrl,
      "",
      `このURLの有効期限は${PASSWORD_LINK_VALIDITY_LABEL}です。心当たりがない場合は、このメールを破棄してください。`,
    ].join("\n"),
  });
}
