import { getAdminBasicAuthConfig } from "@/config/env";
import { verifyAdminBasicAuthorization } from "@/domain/admin/basic-auth";
import {
  BASIC_BOOTSTRAP_ADMIN_USER_ID,
  canAdminUserManagePlatform,
} from "@/domain/admin/admin-user";
import {
  ADMIN_BASIC_AUTH_MAX_FAILURES,
  adminBasicAuthFailureStore,
  type AdminBasicAuthFailureStore,
} from "./admin-basic-auth-rate-limit";

export type AdminBasicAuthAccess =
  | { status: "authorized"; adminUserId: string }
  | { status: "unauthenticated" }
  | { status: "rate-limited" }
  | { status: "unavailable" };

interface AdminBasicAuthDependencies {
  failures: AdminBasicAuthFailureStore;
  findAvailableBootstrapAdmin(): Promise<boolean>;
  verify(authorization: string | null): Promise<boolean>;
}

const defaultDependencies: AdminBasicAuthDependencies = {
  failures: adminBasicAuthFailureStore,
  async findAvailableBootstrapAdmin() {
    const { prisma } = await import("@/infrastructure/database/client");
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: BASIC_BOOTSTRAP_ADMIN_USER_ID },
      select: { status: true },
    });
    return adminUser ? canAdminUserManagePlatform(adminUser.status) : false;
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
      if (!(await dependencies.findAvailableBootstrapAdmin())) {
        return { status: "unavailable" };
      }
      await dependencies.failures.clear();
      return {
        status: "authorized",
        adminUserId: BASIC_BOOTSTRAP_ADMIN_USER_ID,
      };
    } catch {
      return { status: "unavailable" };
    }
  };
}

export const authenticateAdminBasic = createAdminBasicAuthenticator();
