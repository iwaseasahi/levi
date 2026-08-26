"use client";

import { createAuthClient } from "better-auth/react";

import { ADMIN_AUTH_BASE_PATH } from "./admin-options";

export const adminAuthClient = createAuthClient({
  basePath: ADMIN_AUTH_BASE_PATH,
});
