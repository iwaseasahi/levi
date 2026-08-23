import { describe, expect, it, vi } from "vitest";

import {
  ClientApiError,
  parseJsonResponse,
  postJson,
  requestJson,
} from "./client-api";

describe("client JSON API", () => {
  it("returns typed successful JSON", async () => {
    await expect(
      parseJsonResponse<{ value: number }>(
        Response.json({ value: 3 }),
        "failed",
      ),
    ).resolves.toEqual({ value: 3 });
  });

  it("preserves HTTP status and API error code", async () => {
    await expect(
      parseJsonResponse(
        Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
        "failed",
      ),
    ).rejects.toEqual(new ClientApiError("failed", 403, "FORBIDDEN"));
  });

  it("maps malformed responses to the same fallback error", async () => {
    await expect(
      parseJsonResponse(new Response("invalid", { status: 502 }), "failed"),
    ).rejects.toEqual(new ClientApiError("failed", 502));
  });

  it("keeps fetch injection and JSON POST headers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
    await expect(
      requestJson(fetcher, "/read", { cache: "no-store" }, "failed"),
    ).resolves.toEqual({ ok: true });
    await expect(
      postJson(fetcher, "/write", { action: "save" }, "failed"),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenLastCalledWith("/write", {
      body: '{"action":"save"}',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });
});
