import { getAuthRuntimeConfig } from "@/config/env";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { emailChangeService } from "@/infrastructure/auth/email-change-service";
import { createEmailChangeHandler } from "./controller";

export const POST = createEmailChangeHandler({
  getChurchAccess,
  origin: getAuthRuntimeConfig().baseURL,
  service: emailChangeService,
});
