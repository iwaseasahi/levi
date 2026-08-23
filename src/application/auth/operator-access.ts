export type OperatorAccess =
  | { status: "authorized"; userId: string }
  | { status: "forbidden"; userId: string }
  | { status: "unauthenticated" };
