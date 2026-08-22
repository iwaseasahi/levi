import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createProxy, proxy, REQUEST_ID_HEADER } from "./proxy";

describe("proxy", () => {
  it("returns a new UUID request ID instead of trusting caller input", async () => {
    const response = await proxy(
      new NextRequest("https://levi.example/api/health", {
        headers: { [REQUEST_ID_HEADER]: "caller-controlled" },
      }),
    );

    const requestId = response.headers.get(REQUEST_ID_HEADER);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(requestId).not.toBe("caller-controlled");
  });

  it("challenges an unauthenticated admin request without caching it", async () => {
    const handle = createProxy({
      authenticateAdmin: async () => ({ status: "unauthenticated" }),
    });
    const response = await handle(
      new NextRequest("https://levi.example/admin/churches"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="Levi Administration", charset="UTF-8"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns retry guidance when Basic authentication is rate limited", async () => {
    const handle = createProxy({
      authenticateAdmin: async () => ({ status: "rate-limited" }),
    });
    const response = await handle(
      new NextRequest("https://levi.example/admin/churches"),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("fails closed when administration authentication is unavailable", async () => {
    const handle = createProxy({
      authenticateAdmin: async () => ({ status: "unavailable" }),
    });
    const response = await handle(
      new NextRequest("https://levi.example/admin/churches"),
    );

    expect(response.status).toBe(503);
  });

  it("forwards an authorized admin request with a trusted request ID", async () => {
    const handle = createProxy({
      authenticateAdmin: async () => ({
        status: "authorized",
        userId: "00000000-0000-4000-8000-000000000201",
      }),
    });
    const response = await handle(
      new NextRequest("https://levi.example/admin/churches"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
