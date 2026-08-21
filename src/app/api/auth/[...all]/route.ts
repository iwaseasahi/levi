import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/infrastructure/auth/server";

export const { DELETE, GET, PATCH, POST, PUT } = toNextJsHandler(auth);
