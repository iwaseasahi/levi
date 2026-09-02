import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  getMailRuntimeConfig: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock("@/config/env", () => ({
  getMailRuntimeConfig: mocks.getMailRuntimeConfig,
}));

import {
  sendEmailChangeVerificationMail,
  sendChurchPasswordResetMail,
  sendChurchPasswordSetupMail,
  sendAdminPasswordResetMail,
  sendAdminPasswordSetupMail,
} from "./smtp-mailer";

const variants = [
  {
    send: sendChurchPasswordSetupMail,
    subject: "Levi 教会利用者パスワードの設定",
    action: "初回パスワードを設定",
  },
  {
    send: sendChurchPasswordResetMail,
    subject: "Levi 教会利用者パスワードの再設定",
    action: "パスワードを再設定",
  },
  {
    send: sendAdminPasswordSetupMail,
    subject: "Levi 管理者パスワードの設定",
    action: "初回パスワードを設定",
  },
  {
    send: sendAdminPasswordResetMail,
    subject: "Levi 管理者パスワードの再設定",
    action: "パスワードを再設定",
  },
];

const input = {
  name: "Synthetic User",
  resetUrl: "https://example.invalid/reset/synthetic",
  to: "synthetic@example.invalid",
};

describe("SMTP mailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  it.each(variants)(
    "does not send $subject in discarded test delivery",
    async ({ send }) => {
      mocks.getMailRuntimeConfig.mockReturnValue({
        deliveryMode: "discard",
        from: "levi-integration@example.invalid",
      });

      await send(input);

      expect(mocks.createTransport).not.toHaveBeenCalled();
      expect(mocks.sendMail).not.toHaveBeenCalled();
    },
  );

  it.each(variants)(
    "renders distinct $subject with three-day validity",
    async ({ send, subject, action }) => {
      mocks.getMailRuntimeConfig.mockReturnValue({
        deliveryMode: "smtp",
        from: "sender@example.invalid",
        host: "smtp.invalid",
        port: 587,
        secure: false,
      });
      await send(input);
      expect(mocks.sendMail).toHaveBeenCalledExactlyOnceWith({
        from: "sender@example.invalid",
        to: input.to,
        subject,
        text: expect.stringContaining(action),
      });
      const text = mocks.sendMail.mock.calls[0]?.[0].text;
      expect(text).toContain(input.resetUrl);
      expect(text).toContain("有効期限は3日間");
      expect(text).not.toContain("設定または再設定");
    },
  );

  it("sends an expiring email-change verification link to the new address", async () => {
    mocks.getMailRuntimeConfig.mockReturnValue({
      deliveryMode: "smtp",
      from: "sender@example.invalid",
      host: "smtp.invalid",
      port: 587,
      secure: false,
    });
    await sendEmailChangeVerificationMail({
      name: input.name,
      to: input.to,
      verificationUrl: "https://example.invalid/verify-email/synthetic",
    });
    expect(mocks.sendMail).toHaveBeenCalledExactlyOnceWith({
      from: "sender@example.invalid",
      to: input.to,
      subject: "Levi ログイン用メールアドレスの変更",
      text: expect.stringContaining("有効期限は1時間"),
    });
    const text = mocks.sendMail.mock.calls[0]?.[0].text;
    expect(text).toContain("https://example.invalid/verify-email/synthetic");
  });
});
