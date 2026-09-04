import { getAuthRuntimeConfig } from "@/config/env";
import { getSlideImageRuntimeConfig } from "@/config/slide-images";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { slideRepository } from "@/infrastructure/database/slide-repository";
import { normalizeSlideImage } from "@/infrastructure/images/normalize-slide-image";
import { writeLog } from "@/infrastructure/observability/logger";
import { createSlideHandlers } from "./controller";

export const slideHandlers = createSlideHandlers({
  getChurchAccess,
  repository: slideRepository,
  normalizeImage: normalizeSlideImage,
  imageBytesPerChurch: getSlideImageRuntimeConfig().bytesPerChurch,
  origin: getAuthRuntimeConfig().baseURL,
  onMutationResult(action, status) {
    writeLog({
      event: "slides.mutation",
      level: status >= 500 ? "error" : "info",
      attributes: { capability: `slides.${action}`, status },
    });
  },
});
