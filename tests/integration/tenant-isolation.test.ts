import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChurchAccess,
  ChurchScope,
} from "@/application/auth/church-access";
import { createSavedContentHandlers } from "@/app/api/saved-content/controller";
import { prisma } from "@/infrastructure/database/client";
import { savedContentRepository } from "@/infrastructure/database/saved-content-repository";

const prefix = "test.tenant55";

async function clear() {
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
}

async function fixture() {
  const firstChurch = await prisma.church.create({
    data: { name: `${prefix}.first` },
  });
  const secondChurch = await prisma.church.create({
    data: { name: `${prefix}.second` },
  });
  const ownFolder = await prisma.folder.create({
    data: {
      churchId: firstChurch.id,
      name: "Own synthetic folder",
      position: 0,
    },
  });
  const foreignFolder = await prisma.folder.create({
    data: {
      churchId: secondChurch.id,
      name: "Foreign synthetic folder",
      position: 0,
    },
  });
  const scope = { churchId: firstChurch.id } as ChurchScope;
  const access: ChurchAccess = {
    mustChangePassword: false,
    scope,
    status: "authorized",
    userId: randomUUID(),
  };
  return {
    foreignFolder,
    handlers: createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(access),
      repository: savedContentRepository,
    }),
    ownFolder,
    scope,
  };
}

beforeEach(clear);
afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

async function responseEvidence(response: Response) {
  return {
    body: await response.text(),
    cacheControl: response.headers.get("Cache-Control"),
    status: response.status,
  };
}

describe("church tenant negative matrix", () => {
  it("makes foreign and guessed folder reads observably identical", async () => {
    const { foreignFolder, handlers } = await fixture();
    const guessedId = randomUUID();
    const foreign = await responseEvidence(
      await handlers.GET(
        new Request(
          `https://levi.example/api/saved-content?folderId=${foreignFolder.id}`,
        ),
      ),
    );
    const guessed = await responseEvidence(
      await handlers.GET(
        new Request(
          `https://levi.example/api/saved-content?folderId=${guessedId}`,
        ),
      ),
    );

    expect(foreign).toEqual(guessed);
    expect(foreign).toEqual({
      body: JSON.stringify({ error: { code: "SAVED_CONTENT_NOT_FOUND" } }),
      cacheControl: "no-store",
      status: 404,
    });
    expect(foreign.body).not.toContain("Foreign synthetic folder");
  });

  it("rejects mixed and guessed reorder sets without a partial update", async () => {
    const { foreignFolder, handlers, ownFolder, scope } = await fixture();
    const originalOrder = await savedContentRepository.listFolderOrder(scope);
    const post = (ids: string[]) =>
      handlers.POST(
        new Request("https://levi.example/api/saved-content", {
          body: JSON.stringify({ action: "reorder-folders", ids }),
          method: "POST",
        }),
      );

    const mixed = await responseEvidence(
      await post([ownFolder.id, foreignFolder.id]),
    );
    const guessed = await responseEvidence(
      await post([ownFolder.id, randomUUID()]),
    );
    expect(mixed).toEqual(guessed);
    expect(mixed.status).toBe(409);
    await expect(
      savedContentRepository.listFolderOrder(scope),
    ).resolves.toEqual(originalOrder);
  });

  it("does not accept a browser-supplied tenant selector", async () => {
    const { handlers } = await fixture();
    const response = await handlers.GET(
      new Request(
        `https://levi.example/api/saved-content?churchId=${randomUUID()}`,
      ),
    );
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain(prefix);
  });
});
