import { toNextJsHandler } from "better-auth/next-js";

import { adminAuth } from "@/infrastructure/auth/admin-server";

export const { DELETE, GET, PATCH, POST, PUT } = toNextJsHandler(adminAuth);
