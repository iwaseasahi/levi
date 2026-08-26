import { type NextRequest, NextResponse } from "next/server";

import {
  authenticateAdminBasic,
  type AdminBasicAuthAccess,
} from "@/infrastructure/auth/admin-basic-auth";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

interface ProxyDependencies {
  authenticateAdmin(
    authorization: string | null,
  ): Promise<AdminBasicAuthAccess>;
}

function protectedAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin-auth" ||
    pathname.startsWith("/api/admin-auth/")
  );
}

function deniedAdminResponse(
  access: Exclude<AdminBasicAuthAccess, { status: "authorized" }>,
  requestId: string,
) {
  const rateLimited = access.status === "rate-limited";
  const unavailable = access.status === "unavailable";
  const response = new NextResponse(
    unavailable
      ? "Administration is unavailable."
      : rateLimited
        ? "Too many authentication attempts."
        : "Authentication required.",
    {
      headers: {
        "cache-control": "no-store",
        ...(rateLimited ? { "retry-after": "60" } : {}),
        ...(!unavailable && !rateLimited
          ? {
              "www-authenticate":
                'Basic realm="Levi Administration", charset="UTF-8"',
            }
          : {}),
      },
      status: unavailable ? 503 : rateLimited ? 429 : 401,
    },
  );
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function createProxy(
  dependencies: ProxyDependencies = {
    authenticateAdmin: authenticateAdminBasic,
  },
) {
  return async function handleProxy(request: NextRequest) {
    const requestId = crypto.randomUUID();
    if (protectedAdminPath(request.nextUrl.pathname)) {
      const access = await dependencies.authenticateAdmin(
        request.headers.get("authorization"),
      );
      if (access.status !== "authorized") {
        return deniedAdminResponse(access, requestId);
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };
}

export const proxy = createProxy();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
