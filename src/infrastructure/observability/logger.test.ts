import { afterEach, describe, expect, it, vi } from "vitest";

import { writeLog } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeLog", () => {
  it("writes a traceable JSON event", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    writeLog({
      attributes: { method: "GET", status: 200 },
      event: "request.completed",
      level: "info",
      requestId: "request-123",
    });

    const parsed = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(parsed).toMatchObject({
      attributes: { method: "GET", status: 200 },
      event: "request.completed",
      level: "info",
      requestId: "request-123",
    });
    expect(parsed.timestamp).toEqual(expect.any(String));
  });

  it("redacts sensitive keys recursively", () => {
    const output = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    writeLog({
      attributes: {
        authorization: "Bearer not-a-real-token",
        nested: { sessionCookie: "not-a-real-cookie", safe: "visible" },
      },
      event: "request.rejected",
      level: "warn",
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("not-a-real-token");
    expect(serialized).not.toContain("not-a-real-cookie");
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).toContain("visible");
  });
});
