import type { ChurchAccess } from "@/application/auth/church-access";
import {
  createBookmark,
  createSlideBookmark,
  createFolder,
  deleteBookmark,
  deleteFolder,
  listFolderOrder,
  listFolders,
  openBookmark,
  reorderBookmarks,
  reorderFolders,
  selectFolder,
  updateFolder,
  type SavedContentRepository,
} from "@/application/saved-content/manage-saved-content";
import {
  parseSavedContentCommand,
  parseSavedContentId,
  SavedContentError,
} from "@/domain/saved-content";
import { noStoreJson, resolveChurchApiAccess } from "../church-api-support";

type Dependencies = {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  repository: SavedContentRepository;
};

function errorResponse(error: unknown) {
  if (!(error instanceof SavedContentError))
    return noStoreJson({ error: { code: "SAVED_CONTENT_UNAVAILABLE" } }, 500);
  const status =
    error.code === "INVALID_SAVED_CONTENT_INPUT"
      ? 400
      : error.code === "SAVED_CONTENT_NOT_FOUND"
        ? 404
        : 409;
  return noStoreJson({ error: { code: error.code } }, status);
}

export function createSavedContentHandlers(dependencies: Dependencies) {
  return {
    async GET(request: Request) {
      const access = await resolveChurchApiAccess(
        request.headers,
        dependencies.getChurchAccess,
      );
      if ("response" in access) return access.response;
      try {
        const params = new URL(request.url).searchParams;
        if ([...params.keys()].some((key) => key !== "folderId"))
          throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
        const values = params.getAll("folderId");
        if (values.length === 0) {
          const folders = await listFolders(
            dependencies.repository,
            access.scope,
          );
          const orderIds = await listFolderOrder(
            dependencies.repository,
            access.scope,
          );
          return noStoreJson({ folders, orderIds });
        }
        if (values.length !== 1)
          throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
        return noStoreJson(
          await selectFolder(
            dependencies.repository,
            access.scope,
            parseSavedContentId(values[0]),
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },

    async POST(request: Request) {
      const access = await resolveChurchApiAccess(
        request.headers,
        dependencies.getChurchAccess,
      );
      if ("response" in access) return access.response;
      try {
        const command = parseSavedContentCommand(await request.json());
        switch (command.action) {
          case "create-folder":
            return noStoreJson({
              folder: await createFolder(
                dependencies.repository,
                access.scope,
                command.input.name,
              ),
            });
          case "update-folder":
            return noStoreJson({
              folder: await updateFolder(
                dependencies.repository,
                access.scope,
                command.folderId,
                {
                  ...(command.input.name !== undefined
                    ? { name: command.input.name }
                    : {}),
                  ...(command.input.isPinned !== undefined
                    ? { isPinned: command.input.isPinned }
                    : {}),
                },
              ),
            });
          case "reorder-folders":
            await reorderFolders(
              dependencies.repository,
              access.scope,
              command.ids,
            );
            return noStoreJson({ ok: true });
          case "delete-folder":
            await deleteFolder(
              dependencies.repository,
              access.scope,
              command.folderId,
            );
            return noStoreJson({ ok: true });
          case "create-bookmark":
            return noStoreJson({
              bookmark: await createBookmark(
                dependencies.repository,
                access.scope,
                command.folderId,
                command.input,
              ),
            });
          case "create-slide-bookmark":
            return noStoreJson({
              bookmark: await createSlideBookmark(
                dependencies.repository,
                access.scope,
                command.folderId,
                command.slideId,
              ),
            });
          case "open-bookmark":
            return noStoreJson({
              bookmark: await openBookmark(
                dependencies.repository,
                access.scope,
                command.bookmarkId,
              ),
            });
          case "reorder-bookmarks":
            await reorderBookmarks(
              dependencies.repository,
              access.scope,
              command.folderId,
              command.ids,
            );
            return noStoreJson({ ok: true });
          case "delete-bookmark":
            await deleteBookmark(
              dependencies.repository,
              access.scope,
              command.bookmarkId,
            );
            return noStoreJson({ ok: true });
        }
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
