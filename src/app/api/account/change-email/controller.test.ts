import { describe, expect, it, vi } from "vitest";

import type { ChurchAccess } from "@/application/auth/church-access";
import {
  EmailChangeAuthorizationError,
  EmailChangeInputError,
  EmailChangeRateLimitError,
} from "@/application/auth/email-change";
import { createEmailChangeHandler } from "./controller";

const origin = "https://levi.example.invalid";
const authorized = {
  mustChangePassword: false,
  scope: {} as never,
  status: "authorized",
  userId: "user-id",
} satisfies ChurchAccess;

function request(body: unknown, inputOrigin = origin) {
  return new Request(`${origin}/api/account/change-email`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: inputOrigin },
    method: "POST",
  });
}

function handler(
  access: ChurchAccess,
  requestChange = vi.fn().mockResolvedValue(undefined),
) {
  return {
    requestChange,
    post: createEmailChangeHandler({
      getChurchAccess: vi.fn().mockResolvedValue(access),
      origin,
      service: { requestChange },
    }),
  };
}

describe("email change controller", () => {
  it("authorizes a church user and returns an uncached accepted response", async () => {
    const { post, requestChange } = handler(authorized);
    const response = await post(
      request({
        confirmation: "new@example.invalid",
        currentPassword: "current-password",
        newEmail: "new@example.invalid",
      }),
    );
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(requestChange).toHaveBeenCalledWith({
      confirmation: "new@example.invalid",
      currentPassword: "current-password",
      newEmail: "new@example.invalid",
      userId: "user-id",
    });
  });

  it.each([
    [{ status: "unauthenticated" } satisfies ChurchAccess, 401],
    [{ status: "forbidden", userId: "user-id" } satisfies ChurchAccess, 403],
    [{ ...authorized, mustChangePassword: true } satisfies ChurchAccess, 403],
  ])("rejects access before reading secrets", async (access, status) => {
    const { post, requestChange } = handler(access);
    expect((await post(request({ currentPassword: "secret" }))).status).toBe(
      status,
    );
    expect(requestChange).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request", async () => {
    const { post, requestChange } = handler(authorized);
    expect(
      (await post(request({}, "https://attacker.example.invalid"))).status,
    ).toBe(403);
    expect(requestChange).not.toHaveBeenCalled();
  });

  it.each([
    [new EmailChangeInputError(), 400],
    [new EmailChangeAuthorizationError(), 409],
    [new EmailChangeRateLimitError(), 429],
  ])(
    "maps expected failures without returning sensitive data",
    async (error, status) => {
      const { post } = handler(authorized, vi.fn().mockRejectedValue(error));
      const response = await post(request({}));
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain("password");
    },
  );
});
