import { type NextRequest, NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
