import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  church: vi.fn(),
  admin: vi.fn(),
  churchSetup: vi.fn(),
  churchReset: vi.fn(),
  adminSetup: vi.fn(),
  adminReset: vi.fn(),
}));
vi.mock("@/infrastructure/database/client", () => ({
  prisma: {
    user: { findUnique: mocks.church },
    adminUser: { findUnique: mocks.admin },
  },
}));
vi.mock("@/infrastructure/mail/smtp-mailer", () => ({
  sendChurchPasswordSetupMail: mocks.churchSetup,
  sendChurchPasswordResetMail: mocks.churchReset,
  sendAdminPasswordSetupMail: mocks.adminSetup,
  sendAdminPasswordResetMail: mocks.adminReset,
}));

import {
  sendAdminPasswordLinkMail,
  sendChurchPasswordLinkMail,
} from "./password-link-mail";
const input = {
  userId: "synthetic-id",
  name: "Synthetic",
  to: "test@example.invalid",
  resetUrl: "https://example.invalid/reset",
};

describe("password mail lifecycle routing", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["PENDING", "ACTIVE"])(
    "uses persisted church state %s",
    async (actorState) => {
      mocks.church.mockResolvedValue({ actorState });
      await sendChurchPasswordLinkMail(input);
      expect(mocks.church).toHaveBeenCalledWith({
        where: { id: input.userId },
        select: { actorState: true },
      });
      expect(
        actorState === "PENDING" ? mocks.churchSetup : mocks.churchReset,
      ).toHaveBeenCalledExactlyOnceWith(input);
      expect(
        actorState === "PENDING" ? mocks.churchReset : mocks.churchSetup,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(["INVITED", "ACTIVE"])(
    "uses persisted administrator state %s",
    async (status) => {
      mocks.admin.mockResolvedValue({ status });
      await sendAdminPasswordLinkMail(input);
      expect(mocks.admin).toHaveBeenCalledWith({
        where: { id: input.userId },
        select: { status: true },
      });
      expect(
        status === "INVITED" ? mocks.adminSetup : mocks.adminReset,
      ).toHaveBeenCalledExactlyOnceWith(input);
      expect(
        status === "INVITED" ? mocks.adminReset : mocks.adminSetup,
      ).not.toHaveBeenCalled();
    },
  );

  it("does not send for removed or ineligible identities", async () => {
    mocks.church.mockResolvedValue(null);
    mocks.admin
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "SUSPENDED" })
      .mockResolvedValueOnce({ status: "BOOTSTRAP" });
    await sendChurchPasswordLinkMail(input);
    for (let i = 0; i < 3; i++) await sendAdminPasswordLinkMail(input);
    for (const send of [
      mocks.churchSetup,
      mocks.churchReset,
      mocks.adminSetup,
      mocks.adminReset,
    ])
      expect(send).not.toHaveBeenCalled();
  });
});
