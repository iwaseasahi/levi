export type ChurchAccess =
  | {
      churchId: string;
      mustChangePassword: boolean;
      status: "authorized";
      userId: string;
    }
  | { status: "forbidden"; userId: string }
  | { status: "unauthenticated" };

export interface ChurchAccessDependencies {
  findActiveChurchMembership(userId: string): Promise<{
    churchId: string;
    mustChangePassword: boolean;
  } | null>;
  getSessionUserId(headers: Headers): Promise<string | null>;
}

export async function resolveChurchAccess(
  headers: Headers,
  dependencies: ChurchAccessDependencies,
): Promise<ChurchAccess> {
  const userId = await dependencies.getSessionUserId(headers);
  if (!userId) {
    return { status: "unauthenticated" };
  }

  const membership = await dependencies.findActiveChurchMembership(userId);
  if (!membership) {
    return { status: "forbidden", userId };
  }

  return {
    churchId: membership.churchId,
    mustChangePassword: membership.mustChangePassword,
    status: "authorized",
    userId,
  };
}
