import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { slideSearchRepository } from "@/infrastructure/database/slide-search-repository";
import { createSlideSearchHandler } from "./controller";

export const slideSearchHandler = createSlideSearchHandler({
  getChurchAccess,
  repository: slideSearchRepository,
});
