import { describe, expect, it, vi } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import type { SlideRepository } from "@/application/slides/manage-slides";
import { SlideError, type ImageSlideRecord } from "@/domain/slides/commands";
import type { NormalizedSlideImage } from "@/domain/slides/image";
import { createSlideHandlers } from "./controller";

const churchId = "00000000-0000-4000-8000-000000000470";
const id = "00000000-0000-4000-8000-000000000471";
const scope = { churchId } as ChurchScope;
const normalized: NormalizedSlideImage = {
  mediaType: "image/png",
  byteSize: 3,
  width: 1,
  height: 1,
  checksum: "a".repeat(64),
  data: new Uint8Array([1, 2, 3]),
};
const record: ImageSlideRecord = {
  id,
  title: "Synthetic image",
  body: null,
  contentType: "image",
  image: {
    mediaType: "image/png",
    byteSize: 3,
    width: 1,
    height: 1,
  },
  revision: 1,
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
};

function setup() {
  const repository = {
    create: vi.fn(),
    createImage: vi.fn(async () => record),
    find: vi.fn(),
    findImage: vi.fn(async () => normalized),
    getImageUsage: vi.fn(async () => 3),
    update: vi.fn(),
    updateImage: vi.fn(async () => ({ ...record, revision: 2 })),
    updateImageTitle: vi.fn(),
    delete: vi.fn(),
  } satisfies SlideRepository;
  const normalizeImage = vi.fn(async () => normalized);
  const handlers = createSlideHandlers({
    repository,
    normalizeImage,
    imageBytesPerChurch: 100,
    origin: "https://levi.example",
    getChurchAccess: async () => ({
      status: "authorized",
      scope,
      userId: "synthetic",
      mustChangePassword: false,
    }),
  });
  return { handlers, normalizeImage, repository };
}

function imageRequest(method: "POST" | "PUT" = "POST") {
  const form = new FormData();
  form.set("title", " Synthetic image ");
  form.set("image", new File([new Uint8Array([9, 8, 7])], "private.png"));
  if (method === "PUT") form.set("expectedRevision", "1");
  return new Request("https://levi.example/api/church/slides", {
    method,
    headers: { origin: "https://levi.example" },
    body: form,
  });
}

describe("Slide image HTTP boundary", () => {
  it("accepts bounded multipart create without trusting filename or media type", async () => {
    const { handlers, normalizeImage, repository } = setup();
    const response = await handlers.create(imageRequest());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ slide: record });
    expect(normalizeImage).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]));
    expect(repository.createImage).toHaveBeenCalledWith(
      scope,
      { title: "Synthetic image", image: normalized },
      100,
    );
    expect(JSON.stringify(repository.createImage.mock.calls)).not.toContain(
      "private.png",
    );
  });

  it("replaces an image with optimistic revision control", async () => {
    const { handlers, repository } = setup();
    const response = await handlers.update(imageRequest("PUT"), id);
    expect(response.status).toBe(200);
    expect(repository.updateImage).toHaveBeenCalledWith(
      scope,
      id,
      1,
      { title: "Synthetic image", image: normalized },
      100,
    );
  });

  it("rejects a non-canonical multipart revision", async () => {
    const { handlers, normalizeImage } = setup();
    const request = imageRequest("PUT");
    const form = await request.formData();
    form.set("expectedRevision", "1e2");
    const response = await handlers.update(
      new Request(request.url, {
        method: "PUT",
        headers: { origin: "https://levi.example" },
        body: form,
      }),
      id,
    );
    expect(response.status).toBe(400);
    expect(normalizeImage).not.toHaveBeenCalled();
  });

  it("serves exact bytes only for one validated revision query", async () => {
    const { handlers, repository } = setup();
    const response = await handlers.image(
      new Request(
        `https://levi.example/api/church/slides/${id}/image?revision=1`,
      ),
      id,
    );
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      normalized.data,
    );
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(repository.findImage).toHaveBeenCalledWith(scope, id, 1);

    const invalid = await handlers.image(
      new Request(
        `https://levi.example/api/church/slides/${id}/image?revision=1&revision=2`,
      ),
      id,
    );
    expect(invalid.status).toBe(400);
  });

  it("maps quota rejection without exposing image details", async () => {
    const { handlers, repository } = setup();
    repository.createImage.mockRejectedValue(
      new SlideError("SLIDE_IMAGE_QUOTA_EXCEEDED"),
    );
    const response = await handlers.create(imageRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "SLIDE_IMAGE_QUOTA_EXCEEDED" },
    });
  });

  it("rejects oversized multipart before normalization", async () => {
    const { handlers, normalizeImage } = setup();
    const request = imageRequest();
    request.headers.set("content-length", String(11 * 1024 * 1024));
    const response = await handlers.create(request);
    expect(response.status).toBe(400);
    expect(normalizeImage).not.toHaveBeenCalled();
  });
});
