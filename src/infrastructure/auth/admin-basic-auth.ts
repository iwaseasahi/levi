import { getAdminBasicAuthConfig } from "@/config/env";
import { verifyAdminBasicAuthorization } from "@/domain/admin/basic-auth";
import { INTERNAL_PLATFORM_OPERATOR_ID } from "@/domain/admin/platform-operator";
import { prisma } from "@/infrastructure/database/client";
import {
  ADMIN_BASIC_AUTH_MAX_FAILURES,
  adminBasicAuthFailureStore,
  type AdminBasicAuthFailureStore,
} from "./admin-basic-auth-rate-limit";

export type AdminBasicAuthAccess =
  | { status: "authorized"; userId: string }
  | { status: "unauthenticated" }
  | { status: "rate-limited" }
  | { status: "unavailable" };

interface AdminBasicAuthDependencies {
  failures: AdminBasicAuthFailureStore;
  findActiveInternalOperator(): Promise<boolean>;
  verify(authorization: string | null): Promise<boolean>;
}

const defaultDependencies: AdminBasicAuthDependencies = {
  failures: adminBasicAuthFailureStore,
  async findActiveInternalOperator() {
    const operator = await prisma.platformOperator.findUnique({
      where: { userId: INTERNAL_PLATFORM_OPERATOR_ID },
      select: { user: { select: { actorState: true } } },
    });
    return operator?.user.actorState === "ACTIVE";
  },
  verify(authorization) {
    return verifyAdminBasicAuthorization(
      authorization,
      getAdminBasicAuthConfig(),
    );
  },
};

export function createAdminBasicAuthenticator(
  overrides: Partial<AdminBasicAuthDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function authenticate(
    authorization: string | null,
  ): Promise<AdminBasicAuthAccess> {
    try {
      if (await dependencies.failures.isBlocked()) {
        return { status: "rate-limited" };
      }
      if (!(await dependencies.verify(authorization))) {
        const failures = await dependencies.failures.record();
        return failures >= ADMIN_BASIC_AUTH_MAX_FAILURES
          ? { status: "rate-limited" }
          : { status: "unauthenticated" };
      }
      if (!(await dependencies.findActiveInternalOperator())) {
        return { status: "unavailable" };
      }
      await dependencies.failures.clear();
      return {
        status: "authorized",
        userId: INTERNAL_PLATFORM_OPERATOR_ID,
      };
    } catch {
      return { status: "unavailable" };
    }
  };
}

export const authenticateAdminBasic = createAdminBasicAuthenticator();
