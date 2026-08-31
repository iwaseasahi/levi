import { getAuthRuntimeConfig } from "@/config/env";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { slideRepository } from "@/infrastructure/database/slide-repository";
import { writeLog } from "@/infrastructure/observability/logger";
import { createSlideHandlers } from "./controller";

export const slideHandlers = createSlideHandlers({
  getChurchAccess,
  repository: slideRepository,
  origin: getAuthRuntimeConfig().baseURL,
  onMutationResult(action, status) {
    writeLog({
      event: "slides.mutation",
      level: status >= 500 ? "error" : "info",
      attributes: { capability: `slides.${action}`, status },
    });
  },
});
