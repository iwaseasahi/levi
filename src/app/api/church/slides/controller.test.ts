import { describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import type { SlideRepository } from "@/application/slides/manage-slides";
import { SlideError } from "@/domain/slides/commands";
import { createSlideHandlers } from "./controller";

const origin = "https://levi.example.test";
const url = `${origin}/api/church/slides`;
const id = "00000000-0000-4000-8000-000000000394";
const scope = {
  churchId: "00000000-0000-4000-8000-000000000395",
} as ChurchScope;
const input = {
  title: "Synthetic title",
  body: "Synthetic body",
};
const record = {
  ...input,
  id,
  revision: 1,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};
const authorized: ChurchAccess = {
  status: "authorized",
  scope,
  userId: "synthetic-user",
  mustChangePassword: false,
};
function fixture(access: ChurchAccess = authorized) {
  const repository = {
    create: vi.fn().mockResolvedValue(record),
    find: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue({ ...record, revision: 2 }),
    delete: vi.fn().mockResolvedValue(undefined),
  } satisfies SlideRepository;
  const onMutationResult = vi.fn();
  const getChurchAccess = vi.fn().mockResolvedValue(access);
  return {
    repository,
    onMutationResult,
    getChurchAccess,
    handlers: createSlideHandlers({
      repository,
      origin,
      getChurchAccess,
      onMutationResult,
    }),
  };
}
function request(
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Slide HTTP boundary and scoped service", () => {
  it("passes only normalized content and server-derived scope, with stable success statuses", async () => {
    const { handlers, repository, onMutationResult } = fixture();
    const created = await handlers.create(
      request("POST", {
        title: "  Synthetic title\r\n",
        body: "Synthetic\r\nbody",
      }),
    );
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    expect(repository.create).toHaveBeenCalledWith(scope, {
      ...input,
      body: "Synthetic\nbody",
    });
    await expect(created.json()).resolves.toEqual({ slide: record });
    expect((await handlers.read(new Request(url), id)).status).toBe(200);
    expect(repository.find).toHaveBeenCalledWith(scope, id);
    const updated = await handlers.update(
      request("PUT", { input, expectedRevision: 1 }),
      id,
    );
    expect(updated.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith(scope, id, 1, input);
    const deleted = await handlers.delete(
      request("DELETE", { expectedRevision: 2 }),
      id,
    );
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    expect(deleted.headers.get("cache-control")).toBe("no-store");
    expect(repository.delete).toHaveBeenCalledWith(scope, id, 2);
    expect(onMutationResult.mock.calls).toEqual([
      ["create", 201],
      ["update", 200],
      ["delete", 204],
    ]);
  });

  it.each([
    [{ status: "unauthenticated" }, 401],
    [{ status: "forbidden", userId: "denied-user" }, 403],
    [{ ...authorized, mustChangePassword: true }, 403],
  ] as const)(
    "rejects ineligible sessions before input or repository access (case %#)",
    async (access, status) => {
      const { handlers, repository } = fixture(access);
      const responses = await Promise.all([
        handlers.create(new Request(url, { method: "POST", body: "invalid" })),
        handlers.read(new Request(url), "invalid"),
        handlers.update(request("PUT", {}), id),
        handlers.delete(request("DELETE", {}), id),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(status);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
      for (const operation of Object.values(repository))
        expect(operation).not.toHaveBeenCalled();
    },
  );

  it.each(["https://foreign.example", "null", ""])(
    "rejects untrusted or absent Origin (case %#)",
    async (value) => {
      const { handlers, repository } = fixture();
      const req = request("POST", input, { origin: value });
      if (!value) req.headers.delete("origin");
      expect((await handlers.create(req)).status).toBe(403);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [input, { "content-type": "text/plain" }],
    [input, { "content-length": "1048577" }],
    [input, { "content-length": "invalid" }],
    [{ ...input, churchId: scope.churchId }, {}],
    [{ ...input, id }, {}],
    [{ ...input, revision: 2 }, {}],
    [{ ...input, author: "legacy attribution" }, {}],
    [{ ...input, body: "\ud800" }, {}],
    [{ ...input, body: "bad\0text" }, {}],
  ] as const)(
    "rejects unsupported, oversized or malformed input (case %#)",
    async (body, headers) => {
      const { handlers, repository } = fixture();
      expect(
        (await handlers.create(request("POST", body, headers))).status,
      ).toBe(400);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, "1", undefined, 2_147_483_648])(
    "requires a bounded integer revision (case %#)",
    async (expectedRevision) => {
      const { handlers, repository } = fixture();
      expect(
        (await handlers.update(request("PUT", { input, expectedRevision }), id))
          .status,
      ).toBe(400);
      expect(
        (await handlers.delete(request("DELETE", { expectedRevision }), id))
          .status,
      ).toBe(400);
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    },
  );

  it("rejects extra mutation fields, invalid IDs, query fields, missing and invalid JSON", async () => {
    const { handlers } = fixture();
    expect(
      (
        await handlers.update(
          request("PUT", { input, expectedRevision: 1, churchId: id }),
          id,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handlers.update(
          request("PUT", { input, expectedRevision: 1 }),
          "bad-id",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handlers.delete(
          request("DELETE", { expectedRevision: 1, input }),
          id,
        )
      ).status,
    ).toBe(400);
    expect((await handlers.read(new Request(url), "bad-id")).status).toBe(400);
    expect(
      (await handlers.read(new Request(`${url}?churchId=${id}`), id)).status,
    ).toBe(400);
    for (const body of [undefined, "{"]) {
      expect(
        (
          await handlers.create(
            new Request(url, {
              method: "POST",
              headers: { origin, "content-type": "application/json" },
              ...(body !== undefined ? { body } : {}),
            }),
          )
        ).status,
      ).toBe(400);
    }
  });

  it("bounds actual chunked bytes and rejects malformed UTF-8 while accepting split Unicode", async () => {
    const { handlers, repository } = fixture();
    async function send(chunks: Uint8Array[]) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
      const init = {
        method: "POST",
        headers: { origin, "content-type": "application/json; charset=utf-8" },
        body: stream,
        duplex: "half",
      };
      return handlers.create(new Request(url, init));
    }
    expect(
      (
        await send([
          new Uint8Array(700_000).fill(32),
          new Uint8Array(400_000).fill(32),
        ])
      ).status,
    ).toBe(400);
    expect((await send([new Uint8Array([255])])).status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
    const bytes = new TextEncoder().encode(
      JSON.stringify({ ...input, body: "😀日本語" }),
    );
    const chunks = Array.from(bytes, (byte) => new Uint8Array([byte]));
    expect((await send(chunks)).status).toBe(201);
    expect(repository.create).toHaveBeenCalledWith(scope, {
      ...input,
      body: "😀日本語",
    });
  });

  it("returns indistinguishable not-found and conflict errors without content", async () => {
    const { handlers, repository } = fixture();
    repository.find.mockResolvedValue(null);
    const missing = await handlers.read(new Request(url), id);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: { code: "SLIDE_NOT_FOUND" },
    });
    repository.update.mockRejectedValue(new SlideError("SLIDE_CONFLICT"));
    expect(
      (
        await handlers.update(
          request("PUT", { input, expectedRevision: 1 }),
          id,
        )
      ).status,
    ).toBe(409);
    repository.delete.mockRejectedValue(new SlideError("SLIDE_NOT_FOUND"));
    expect(
      (await handlers.delete(request("DELETE", { expectedRevision: 1 }), id))
        .status,
    ).toBe(404);
    repository.create.mockRejectedValue(new Error("private synthetic details"));
    const failed = await handlers.create(request("POST", input));
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("private");
  });

  it("fails closed if session resolution is unavailable", async () => {
    const { handlers, getChurchAccess, repository } = fixture();
    getChurchAccess.mockRejectedValue(new Error("session store offline"));
    expect((await handlers.read(new Request(url), id)).status).toBe(500);
    expect(repository.find).not.toHaveBeenCalled();
  });
});
