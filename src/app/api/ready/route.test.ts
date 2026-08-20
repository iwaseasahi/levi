import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseReadiness, writeLog } = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
  writeLog: vi.fn(),
}));

vi.mock("@/infrastructure/database/readiness", () => ({
  checkDatabaseReadiness,
}));
vi.mock("@/infrastructure/observability/logger", () => ({ writeLog }));

import { GET } from "./route";

beforeEach(() => {
  checkDatabaseReadiness.mockReset();
  writeLog.mockReset();
});

describe("GET /api/ready", () => {
  it("reports ready when required dependencies answer", async () => {
    checkDatabaseReadiness.mockResolvedValue(undefined);

    const response = await GET(
      new Request("https://levi.example/api/ready", {
        headers: { "x-request-id": "request-ready" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request-ready");
    await expect(response.json()).resolves.toMatchObject({
      checks: { database: "ok" },
      status: "ready",
    });
  });

  it("fails closed without exposing dependency errors", async () => {
    checkDatabaseReadiness.mockRejectedValue(
      new Error("sensitive connection detail"),
    );

    const response = await GET(
      new Request("https://levi.example/api/ready", {
        headers: { "x-request-id": "request-unready" },
      }),
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("request-unready");
    expect(body).toContain("unavailable");
    expect(body).not.toContain("sensitive connection detail");
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "readiness.failed",
        requestId: "request-unready",
      }),
    );
  });
});
