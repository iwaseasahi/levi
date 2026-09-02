import { createEmailVerificationToken } from "better-auth/api";
import { verifyPassword } from "better-auth/crypto";

import { createEmailChangeService } from "@/application/auth/email-change";
import { EMAIL_CHANGE_EXPIRES_IN_SECONDS } from "@/config/email-change";
import { getAuthRuntimeConfig } from "@/config/env";
import { prisma } from "@/infrastructure/database/client";
import { sendEmailChangeVerificationMail } from "@/infrastructure/mail/smtp-mailer";
import { consumeEmailChangeRequest } from "./email-change-rate-limit";

export const emailChangeService = createEmailChangeService({
  consumeRequest: consumeEmailChangeRequest,
  async createVerificationUrl({ currentEmail, newEmail }) {
    const config = getAuthRuntimeConfig();
    const token = await createEmailVerificationToken(
      config.secret,
      currentEmail,
      newEmail,
      EMAIL_CHANGE_EXPIRES_IN_SECONDS,
      { requestType: "change-email-verification" },
    );
    const url = new URL("/api/auth/verify-email", config.baseURL);
    url.searchParams.set("token", token);
    url.searchParams.set("callbackURL", "/account/change-email?completed=1");
    return url.toString();
  },
  async findCredential(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        accounts: {
          where: { providerId: "credential" },
          select: { password: true },
          take: 1,
        },
      },
    });
    const passwordHash = user?.accounts[0]?.password;
    return user && passwordHash
      ? { email: user.email, name: user.name, passwordHash }
      : null;
  },
  async isEmailInUse(email) {
    return (await prisma.user.count({ where: { email } })) > 0;
  },
  sendVerificationMail: sendEmailChangeVerificationMail,
  verifyPassword,
});
