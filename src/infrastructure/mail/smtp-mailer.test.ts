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

import { sendChurchPasswordResetMail } from "./smtp-mailer";

describe("SMTP mailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  it("does not create a transport in discarded test delivery", async () => {
    mocks.getMailRuntimeConfig.mockReturnValue({
      deliveryMode: "discard",
      from: "levi-integration@example.invalid",
    });

    await sendChurchPasswordResetMail({
      name: "Synthetic User",
      resetUrl: "https://example.invalid/reset/synthetic",
      to: "synthetic@example.invalid",
    });

    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
