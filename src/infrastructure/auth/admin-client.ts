"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

import { ADMIN_AUTH_BASE_PATH } from "./admin-options";

export const adminAuthClient = createAuthClient({
  basePath: ADMIN_AUTH_BASE_PATH,
  plugins: [usernameClient({ displayUsername: false })],
});
