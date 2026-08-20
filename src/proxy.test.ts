import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy, REQUEST_ID_HEADER } from "./proxy";

describe("proxy", () => {
  it("returns a new UUID request ID instead of trusting caller input", () => {
    const response = proxy(
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
});
