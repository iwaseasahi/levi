import { prisma } from "@/infrastructure/database/client";
import {
  type PasswordResetMail,
  sendAdminPasswordResetMail,
  sendAdminPasswordSetupMail,
  sendChurchPasswordResetMail,
  sendChurchPasswordSetupMail,
} from "@/infrastructure/mail/smtp-mailer";

type PasswordLinkMail = PasswordResetMail & { userId: string };

export async function sendChurchPasswordLinkMail(input: PasswordLinkMail) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { actorState: true },
  });
  if (!user) return;
  // The persisted lifecycle state, not a client-supplied purpose, selects copy.
  return user.actorState === "PENDING"
    ? sendChurchPasswordSetupMail(input)
    : sendChurchPasswordResetMail(input);
}

export async function sendAdminPasswordLinkMail(input: PasswordLinkMail) {
  const user = await prisma.adminUser.findUnique({
    where: { id: input.userId },
    select: { status: true },
  });
  if (!user || (user.status !== "INVITED" && user.status !== "ACTIVE")) return;
  return user.status === "INVITED"
    ? sendAdminPasswordSetupMail(input)
    : sendAdminPasswordResetMail(input);
}
