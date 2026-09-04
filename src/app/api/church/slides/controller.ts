import type { ChurchScope } from "@/application/auth/church-access";
import {
  createSlideService,
  type SlideRepository,
} from "@/application/slides/manage-slides";
import {
  slideImageUploadLimit,
  type NormalizedSlideImage,
} from "@/domain/slides/image";
import { SlideError } from "@/domain/slides/commands";
import { SlideInputError } from "@/domain/slides/slide";
import {
  noStoreJson,
  resolveChurchApiAccess,
  type ChurchAccessResolver,
} from "../../church-api-support";

const maxBytes = 1_048_576;
const maxMultipartBytes = slideImageUploadLimit + 16 * 1024;
type Action = "create" | "read" | "update" | "delete";

async function readBoundedBytes(request: Request, limit: number) {
  const length = request.headers.get("content-length");
  if (
    (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) ||
    !request.body
  ) {
    throw new SlideInputError();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new SlideInputError();
      chunks.push(value);
    }
    const result = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new SlideInputError();
  } finally {
    reader.releaseLock();
  }
}

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

async function readImageForm(
  request: Request,
  updating: boolean,
): Promise<{ title: string; expectedRevision?: string; bytes: Uint8Array }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new SlideInputError();
  const raw = await readBoundedBytes(request, maxMultipartBytes);
  let form: FormData;
  try {
    form = await new Response(raw, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new SlideInputError();
  }
  const expected = updating
    ? ["title", "image", "expectedRevision"]
    : ["title", "image"];
  if (
    [...form.keys()].some((key) => !expected.includes(key)) ||
    expected.some((key) => form.getAll(key).length !== 1)
  ) {
    throw new SlideInputError();
  }
  const title = form.get("title");
  const image = form.get("image");
  const expectedRevision = form.get("expectedRevision");
  if (
    typeof title !== "string" ||
    !(image instanceof Blob) ||
    image.size < 1 ||
    image.size > slideImageUploadLimit ||
    (updating &&
      (typeof expectedRevision !== "string" ||
        !/^[1-9]\d*$/.test(expectedRevision) ||
        Number(expectedRevision) > 2_147_483_647))
  ) {
    throw new SlideInputError();
  }
  return {
    title,
    bytes: new Uint8Array(await image.arrayBuffer()),
    ...(typeof expectedRevision === "string" ? { expectedRevision } : {}),
  };
}

export function createSlideHandlers(dependencies: {
  getChurchAccess: ChurchAccessResolver;
  repository: SlideRepository;
  normalizeImage?: (bytes: Uint8Array) => Promise<NormalizedSlideImage>;
  imageBytesPerChurch?: number;
  origin: string;
  onMutationResult?: (action: Exclude<Action, "read">, status: number) => void;
}) {
  const service = createSlideService(dependencies.repository, {
    ...(dependencies.imageBytesPerChurch === undefined
      ? {}
      : { imageBytesPerChurch: dependencies.imageBytesPerChurch }),
  });
  async function respond(
    request: Request,
    action: Action,
    operation: (scope: ChurchScope) => Promise<Response>,
    allowQuery = false,
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
        if (!allowQuery && new URL(request.url).searchParams.size)
          throw new SlideInputError();
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
              : code === "SLIDE_IMAGE_QUOTA_EXCEEDED"
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
      respond(request, "create", async (scope) => {
        if (
          request.headers
            .get("content-type")
            ?.toLowerCase()
            .startsWith("multipart/form-data;")
        ) {
          const input = await readImageForm(request, false);
          if (!dependencies.normalizeImage) throw new SlideInputError();
          const image = await dependencies.normalizeImage(input.bytes);
          return noStoreJson(
            { slide: await service.createImage(scope, input.title, image) },
            201,
          );
        }
        return noStoreJson(
          { slide: await service.create(scope, await readJson(request)) },
          201,
        );
      }),
    read: (request: Request, id: string) =>
      respond(request, "read", async (scope) =>
        noStoreJson({ slide: await service.get(scope, id) }),
      ),
    update: (request: Request, id: string) =>
      respond(request, "update", async (scope) => {
        if (
          request.headers
            .get("content-type")
            ?.toLowerCase()
            .startsWith("multipart/form-data;")
        ) {
          const input = await readImageForm(request, true);
          if (!dependencies.normalizeImage) throw new SlideInputError();
          const image = await dependencies.normalizeImage(input.bytes);
          return noStoreJson({
            slide: await service.updateImage(
              scope,
              id,
              Number(input.expectedRevision),
              input.title,
              image,
            ),
          });
        }
        return noStoreJson({
          slide: await service.update(scope, id, await readJson(request)),
        });
      }),
    image: (request: Request, id: string) =>
      respond(
        request,
        "read",
        async (scope) => {
          const params = new URL(request.url).searchParams;
          if (
            params.size !== 1 ||
            params.getAll("revision").length !== 1 ||
            !params.has("revision")
          ) {
            throw new SlideInputError();
          }
          const revision = params.get("revision");
          if (!revision || !/^\d+$/.test(revision)) throw new SlideInputError();
          const image = await service.getImage(scope, id, Number(revision));
          return new Response(Buffer.from(image.data), {
            headers: {
              "Cache-Control": "private, no-store",
              "Content-Length": String(image.byteSize),
              "Content-Type": image.mediaType,
              "X-Content-Type-Options": "nosniff",
            },
          });
        },
        true,
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
