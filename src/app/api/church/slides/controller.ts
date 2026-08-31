import type { ChurchScope } from "@/application/auth/church-access";
import {
  createSlideService,
  type SlideRepository,
} from "@/application/slides/manage-slides";
import { SlideError } from "@/domain/slides/commands";
import { SlideInputError } from "@/domain/slides/slide";
import {
  noStoreJson,
  resolveChurchApiAccess,
  type ChurchAccessResolver,
} from "../../church-api-support";

const maxBytes = 1_048_576;
type Action = "create" | "read" | "update" | "delete";

async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) ||
    !request.body
  ) {
    throw new SlideInputError();
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new SlideInputError();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new SlideInputError();
  } finally {
    reader.releaseLock();
  }
}

export function createSlideHandlers(dependencies: {
  getChurchAccess: ChurchAccessResolver;
  repository: SlideRepository;
  origin: string;
  onMutationResult?: (action: Exclude<Action, "read">, status: number) => void;
}) {
  const service = createSlideService(dependencies.repository);
  async function respond(
    request: Request,
    action: Action,
    operation: (scope: ChurchScope) => Promise<Response>,
  ) {
    let response: Response;
    try {
      const access = await resolveChurchApiAccess(
        request.headers,
        dependencies.getChurchAccess,
      );
      if ("response" in access) response = access.response;
      else if (
        action !== "read" &&
        request.headers.get("origin") !== dependencies.origin
      ) {
        response = noStoreJson({ error: { code: "FORBIDDEN" } }, 403);
      } else {
        if (new URL(request.url).searchParams.size) throw new SlideInputError();
        response = await operation(access.scope);
      }
    } catch (error) {
      const code =
        error instanceof SlideInputError || error instanceof SlideError
          ? error.code
          : "SLIDE_UNAVAILABLE";
      const status =
        code === "INVALID_SLIDE_INPUT"
          ? 400
          : code === "SLIDE_NOT_FOUND"
            ? 404
            : code === "SLIDE_CONFLICT"
              ? 409
              : 500;
      response = noStoreJson({ error: { code } }, status);
    }
    if (action !== "read")
      dependencies.onMutationResult?.(action, response.status);
    return response;
  }
  return {
    create: (request: Request) =>
      respond(request, "create", async (scope) =>
        noStoreJson(
          { slide: await service.create(scope, await readJson(request)) },
          201,
        ),
      ),
    read: (request: Request, id: string) =>
      respond(request, "read", async (scope) =>
        noStoreJson({ slide: await service.get(scope, id) }),
      ),
    update: (request: Request, id: string) =>
      respond(request, "update", async (scope) =>
        noStoreJson({
          slide: await service.update(scope, id, await readJson(request)),
        }),
      ),
    delete: (request: Request, id: string) =>
      respond(request, "delete", async (scope) => {
        await service.delete(scope, id, await readJson(request));
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      }),
  };
}
