import type { ChurchAccess } from "@/application/auth/church-access";
import {
  createBookmark,
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

type Dependencies = {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  repository: SavedContentRepository;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

function errorResponse(error: unknown) {
  if (!(error instanceof SavedContentError))
    return json({ error: { code: "SAVED_CONTENT_UNAVAILABLE" } }, 500);
  const status =
    error.code === "INVALID_SAVED_CONTENT_INPUT"
      ? 400
      : error.code === "SAVED_CONTENT_NOT_FOUND"
        ? 404
        : 409;
  return json({ error: { code: error.code } }, status);
}

async function authorized(request: Request, dependencies: Dependencies) {
  const access = await dependencies.getChurchAccess(request.headers);
  if (access.status === "unauthenticated")
    return { response: json({ error: { code: "UNAUTHENTICATED" } }, 401) };
  if (access.status !== "authorized" || access.mustChangePassword)
    return { response: json({ error: { code: "FORBIDDEN" } }, 403) };
  return { churchId: access.churchId };
}

export function createSavedContentHandlers(dependencies: Dependencies) {
  return {
    async GET(request: Request) {
      const access = await authorized(request, dependencies);
      if ("response" in access) return access.response;
      try {
        const params = new URL(request.url).searchParams;
        if ([...params.keys()].some((key) => key !== "folderId"))
          throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
        const values = params.getAll("folderId");
        if (values.length === 0) {
          const folders = await listFolders(
            dependencies.repository,
            access.churchId,
          );
          const orderIds = await listFolderOrder(
            dependencies.repository,
            access.churchId,
          );
          return json({ folders, orderIds });
        }
        if (values.length !== 1)
          throw new SavedContentError("INVALID_SAVED_CONTENT_INPUT");
        return json(
          await selectFolder(
            dependencies.repository,
            access.churchId,
            parseSavedContentId(values[0]),
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },

    async POST(request: Request) {
      const access = await authorized(request, dependencies);
      if ("response" in access) return access.response;
      try {
        const command = parseSavedContentCommand(await request.json());
        switch (command.action) {
          case "create-folder":
            return json({
              folder: await createFolder(
                dependencies.repository,
                access.churchId,
                command.input.name,
              ),
            });
          case "update-folder":
            return json({
              folder: await updateFolder(
                dependencies.repository,
                access.churchId,
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
              access.churchId,
              command.ids,
            );
            return json({ ok: true });
          case "delete-folder":
            await deleteFolder(
              dependencies.repository,
              access.churchId,
              command.folderId,
            );
            return json({ ok: true });
          case "create-bookmark":
            return json({
              bookmark: await createBookmark(
                dependencies.repository,
                access.churchId,
                command.folderId,
                command.input,
              ),
            });
          case "open-bookmark":
            return json({
              bookmark: await openBookmark(
                dependencies.repository,
                access.churchId,
                command.bookmarkId,
              ),
            });
          case "reorder-bookmarks":
            await reorderBookmarks(
              dependencies.repository,
              access.churchId,
              command.folderId,
              command.ids,
            );
            return json({ ok: true });
          case "delete-bookmark":
            await deleteBookmark(
              dependencies.repository,
              access.churchId,
              command.bookmarkId,
            );
            return json({ ok: true });
        }
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
