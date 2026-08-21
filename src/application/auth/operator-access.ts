export type OperatorAccess =
  | { status: "authorized"; userId: string }
  | { status: "forbidden"; userId: string }
  | { status: "unauthenticated" };

export interface OperatorAccessDependencies {
  findActiveOperator(userId: string): Promise<boolean>;
  getSessionUserId(headers: Headers): Promise<string | null>;
}

export async function resolveOperatorAccess(
  headers: Headers,
  dependencies: OperatorAccessDependencies,
): Promise<OperatorAccess> {
  const userId = await dependencies.getSessionUserId(headers);

  if (!userId) {
    return { status: "unauthenticated" };
  }

  if (!(await dependencies.findActiveOperator(userId))) {
    return { status: "forbidden", userId };
  }

  return { status: "authorized", userId };
}
