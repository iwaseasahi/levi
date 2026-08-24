export type OperatorAccess =
  | { status: "authorized"; adminUserId: string }
  | { status: "forbidden"; adminUserId: string }
  | { status: "unauthenticated" };
