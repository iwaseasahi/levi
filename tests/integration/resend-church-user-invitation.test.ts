import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  InvitationResendAuthorizationError,
  InvitationResendRateLimitError,
  InvitationResendUnavailableError,
} from "@/application/admin/resend-church-user-invitation";
import { inviteChurchUser } from "@/infrastructure/auth/church-user-invitations";
import { resendChurchUserInvitation } from "@/infrastructure/auth/church-user-invitation-resend";
import * as mail from "@/infrastructure/auth/password-link-mail";
import { auth } from "@/infrastructure/auth/server";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.invitation-resend";
async function clear() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: namespace } },
    select: { id: true },
  });
  await prisma.verification.deleteMany({
    where: { value: { in: users.map((u) => u.id) } },
  });
  await prisma.rateLimit.deleteMany({
    where: {
      key: { in: users.map((u) => `church-invitation-resend:${u.id}`) },
    },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: namespace } } });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: namespace } },
  });
}
async function setup() {
  const admin = await prisma.adminUser.create({
    data: {
      name: "Synthetic Operator",
      email: `${namespace}.${randomUUID()}@example.invalid`,
      status: "ACTIVE",
    },
  });
  const church = await prisma.church.create({
    data: { name: `${namespace} church` },
  });
  const user = await inviteChurchUser(admin.id, {
    accountName: "Synthetic Invitee",
    churchId: church.id,
    email: `${namespace}.${randomUUID()}@example.invalid`,
  });
  return { admin, church, user };
}
beforeEach(clear);
afterEach(async () => {
  vi.restoreAllMocks();
  await clear();
});
afterAll(() => prisma.$disconnect());

describe("church invitation resend transaction", () => {
  it("replaces expired and unexpired links, preserves the identity, and activates with a single-use 72-hour link", async () => {
    const { admin, church, user } = await setup();
    const initial = await prisma.verification.findFirstOrThrow({
      where: { value: user.userId },
    });
    await prisma.verification.update({
      where: { id: initial.id },
      data: {
        createdAt: new Date(Date.now() - 73 * 3600 * 1000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const other = await prisma.verification.create({
      data: {
        identifier: `reset-password:${randomUUID()}`,
        value: user.userId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const before = Date.now();
    await resendChurchUserInvitation(admin.id, church.id, user.userId);
    const tokens = await prisma.verification.findMany({
      where: { value: user.userId },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.id === initial.id || tokens[0]!.id === other.id).toBe(
      false,
    );
    expect(tokens[0]!.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      72 * 3600 * 1000 - 1000,
    );
    expect(tokens[0]!.expiresAt.getTime() - before).toBeLessThan(
      72 * 3600 * 1000 + 5000,
    );
    expect(
      await prisma.churchMembership.count({
        where: { userId: user.userId, churchId: church.id },
      }),
    ).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.userId } }))
        .actorState,
    ).toBe("PENDING");
    const password = "synthetic-resend-password";
    const reset = (token: string) =>
      auth.api.resetPassword({
        body: { token, newPassword: password },
        asResponse: true,
      });
    expect(
      (await reset(other.identifier.slice("reset-password:".length))).ok,
    ).toBe(false);
    const token = tokens[0]!.identifier.slice("reset-password:".length);
    expect((await reset(token)).ok).toBe(true);
    expect((await reset(token)).ok).toBe(false);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.userId } }))
        .actorState,
    ).toBe("ACTIVE");
  });
  it("rolls back token replacement and cooldown after SMTP failure without deleting the user", async () => {
    const { admin, church, user } = await setup();
    const old = await prisma.verification.findFirstOrThrow({
      where: { value: user.userId },
    });
    const sender = vi
      .spyOn(mail, "sendChurchPasswordLinkMail")
      .mockRejectedValue(new Error("synthetic SMTP failure"));
    await expect(
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ).rejects.toThrow();
    expect(
      (
        await prisma.verification.findMany({ where: { value: user.userId } })
      ).map((v) => v.id),
    ).toEqual([old.id]);
    expect(await prisma.user.count({ where: { id: user.userId } })).toBe(1);
    sender.mockRestore();
    await expect(
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ).resolves.toBeUndefined();
  });
  it("serializes parallel resends, applies cooldown and permits resend after the window", async () => {
    const { admin, church, user } = await setup();
    const sender = vi
      .spyOn(mail, "sendChurchPasswordLinkMail")
      .mockResolvedValue(undefined);
    const results = await Promise.allSettled([
      resendChurchUserInvitation(admin.id, church.id, user.userId),
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InvitationResendRateLimitError);
    expect(sender).toHaveBeenCalledTimes(1);
    await prisma.rateLimit.update({
      where: { key: `church-invitation-resend:${user.userId}` },
      data: { lastRequest: BigInt(Date.now() - 61_000) },
    });
    await resendChurchUserInvitation(admin.id, church.id, user.userId);
    expect(sender).toHaveBeenCalledTimes(2);
    expect(
      await prisma.verification.count({ where: { value: user.userId } }),
    ).toBe(1);
  });
  it("rejects invalid actor, wrong church, missing/active user, and suspended church without sending", async () => {
    const { admin, church, user } = await setup();
    const sender = vi
      .spyOn(mail, "sendChurchPasswordLinkMail")
      .mockResolvedValue(undefined);
    await expect(
      resendChurchUserInvitation(user.userId, church.id, user.userId),
    ).rejects.toBeInstanceOf(InvitationResendAuthorizationError);
    await expect(
      resendChurchUserInvitation(admin.id, randomUUID(), user.userId),
    ).rejects.toBeInstanceOf(InvitationResendUnavailableError);
    await expect(
      resendChurchUserInvitation(admin.id, church.id, randomUUID()),
    ).rejects.toBeInstanceOf(InvitationResendUnavailableError);
    await prisma.user.update({
      where: { id: user.userId },
      data: { actorState: "ACTIVE" },
    });
    await expect(
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ).rejects.toBeInstanceOf(InvitationResendUnavailableError);
    await prisma.user.update({
      where: { id: user.userId },
      data: { actorState: "PENDING" },
    });
    await prisma.church.update({
      where: { id: church.id },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    await expect(
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ).rejects.toBeInstanceOf(InvitationResendUnavailableError);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { status: "INVITED" },
    });
    await expect(
      resendChurchUserInvitation(admin.id, church.id, user.userId),
    ).rejects.toBeInstanceOf(InvitationResendAuthorizationError);
    expect(sender).not.toHaveBeenCalled();
  });
});
