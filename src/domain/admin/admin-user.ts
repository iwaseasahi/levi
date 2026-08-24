export const BASIC_BOOTSTRAP_ADMIN_USER_ID =
  "00000000-0000-4000-8000-000000000201";
export const BASIC_BOOTSTRAP_ADMIN_LOGIN_ID = "basic-bootstrap";
export const BASIC_BOOTSTRAP_ADMIN_NAME = "Levi Basic Bootstrap Administrator";

export function canAdminUserManagePlatform(status: string) {
  return status === "BOOTSTRAP" || status === "ACTIVE";
}
