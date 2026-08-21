import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { savedContentRepository } from "@/infrastructure/database/saved-content-repository";
import { createSavedContentHandlers } from "./controller";

export const dynamic = "force-dynamic";

const handlers = createSavedContentHandlers({
  getChurchAccess,
  repository: savedContentRepository,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
