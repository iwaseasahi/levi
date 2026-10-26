import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import {
  createChurchUserInvitationResender,
  type InvitationResendStore,
} from "@/application/admin/resend-church-user-invitation";
import { getAuthRuntimeConfig } from "@/config/env";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { buildAuthOptions } from "./options";
import { sendChurchPasswordLinkMail } from "./password-link-mail";

function createStore(
  transaction: Prisma.TransactionClient,
): InvitationResendStore {
  return {
    async canManage(adminUserId) {
      const actors = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM admin_users
        WHERE id = ${adminUserId}::uuid AND status IN ('ACTIVE', 'BOOTSTRAP')
        FOR SHARE
      `;
      return actors.length === 1;
    },
    async findPendingRecipient(churchId, userId) {
      // Serialize resends and keep lifecycle/membership changes out of delivery.
      const users = await transaction.$queryRaw<Array<{ email: string }>>`
        SELECT u.email FROM users u
        JOIN church_memberships m ON m.user_id = u.id
        JOIN churches c ON c.id = m.church_id
        WHERE u.id = ${userId}::uuid AND c.id = ${churchId}::uuid
          AND u.actor_state = 'PENDING' AND c.status = 'ACTIVE'
        FOR UPDATE OF u FOR SHARE OF m, c
      `;
      return users[0]?.email ?? null;
    },
    async consumeResend(userId) {
      const key = `church-invitation-resend:${userId}`;
      const now = Date.now();
      const previous = await transaction.rateLimit.findUnique({
        where: { key },
      });
      if (previous && Number(previous.lastRequest) > now - 60_000) return false;
      await transaction.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, lastRequest: BigInt(now) },
        update: { count: 1, lastRequest: BigInt(now) },
      });
      return true;
    },
    async replaceInvitation(userId, email) {
      await transaction.verification.deleteMany({
        where: { value: userId, identifier: { startsWith: "reset-password:" } },
      });
      // Bind Better Auth's existing token creation to this transaction so mail
      // failure restores old links and removes the unsent replacement token.
      const config = getAuthRuntimeConfig();
      let delivery:
        Parameters<typeof sendChurchPasswordLinkMail>[0] | undefined;
      const invitationAuth = betterAuth({
        ...buildAuthOptions(config, {
          async sendResetPassword(input) {
            delivery = input;
          },
        }),
        database: prismaAdapter(transaction, { provider: "postgresql" }),
      });
      await invitationAuth.api.requestPasswordReset({
        body: { email, redirectTo: `${config.baseURL}/reset-password` },
      });
      // Better Auth intentionally swallows mail callback errors for public
      // recovery responses. Await delivery here to expose failure to the admin
      // and roll back the replacement instead of reporting false success.
      if (!delivery) throw new Error("Invitation delivery was not prepared");
      await sendChurchPasswordLinkMail(delivery);
    },
  };
}

export const resendChurchUserInvitation = createChurchUserInvitationResender({
  runTransaction(operation) {
    // External delivery must not be retried automatically.
    return prisma.$transaction(
      (transaction) => operation(createStore(transaction)),
      {
        timeout: 30_000,
      },
    );
  },
});
