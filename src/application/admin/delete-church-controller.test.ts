import { describe, expect, it, vi } from "vitest";

import {
  ChurchDeletionConfirmationError,
  ChurchDeletionNotFoundError,
} from "./delete-church";
import { createDeleteChurchController } from "./delete-church-controller";

function createController(overrides: Record<string, unknown> = {}) {
  return createDeleteChurchController({
    deleteChurch: vi.fn().mockResolvedValue(undefined),
    getOperatorAccess: vi.fn().mockResolvedValue({
      adminUserId: "admin-1",
      status: "authorized",
    }),
    recordEvent: vi.fn(),
    ...overrides,
  });
}

describe("createDeleteChurchController", () => {
  it("deletes the confirmed church and records only stable identifiers", async () => {
    const deleteChurch = vi.fn().mockResolvedValue(undefined);
    const recordEvent = vi.fn();

    const result = await createController({ deleteChurch, recordEvent })(
      new Headers(),
      " church-1 ",
      " 第一教会 ",
      "request-1",
    );

    expect(deleteChurch).toHaveBeenCalledWith(
      "admin-1",
      "church-1",
      "第一教会",
    );
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "admin-1",
      outcome: "succeeded",
      requestId: "request-1",
      targetChurchId: "church-1",
    });
    expect(result).toEqual({
      message: "教会を削除しました。",
      status: "success",
    });
  });

  it("rejects an unauthenticated request before deletion", async () => {
    const deleteChurch = vi.fn();
    const result = await createController({
      deleteChurch,
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "unauthenticated" }),
    })(new Headers(), "church-1", "第一教会");

    expect(deleteChurch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it.each([
    ["", "第一教会", "削除する教会を選択してください。"],
    ["church-1", "", "確認のため教会名を入力してください。"],
  ])("validates the target and confirmation", async (id, name, message) => {
    const deleteChurch = vi.fn();
    const result = await createController({ deleteChurch })(
      new Headers(),
      id,
      name,
    );

    expect(deleteChurch).not.toHaveBeenCalled();
    expect(result).toEqual({ message, status: "error" });
  });

  it.each([
    [
      new ChurchDeletionConfirmationError(),
      "教会名が一致しません。表示されている教会名を入力してください。",
    ],
    [new ChurchDeletionNotFoundError(), "対象の教会は既に削除されています。"],
  ])("returns a specific safe failure message", async (error, message) => {
    const result = await createController({
      deleteChurch: vi.fn().mockRejectedValue(error),
    })(new Headers(), "church-1", "第一教会");

    expect(result).toEqual({ message, status: "error" });
  });
});
