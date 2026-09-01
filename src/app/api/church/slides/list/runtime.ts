import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { slideListRepository } from "@/infrastructure/database/slide-list-repository";
import { createSlideListHandler } from "./controller";

export const slideListHandler = createSlideListHandler({
  getChurchAccess,
  repository: slideListRepository,
});
