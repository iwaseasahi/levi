import { randomUUID } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createSlideHandlers } from "@/app/api/church/slides/controller";
import { createSlideListHandler } from "@/app/api/church/slides/list/controller";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { prisma } from "@/infrastructure/database/client";
import { slideRepository } from "@/infrastructure/database/slide-repository";
import { slideListRepository } from "@/infrastructure/database/slide-list-repository";

const prefix = "test.slide-authorization.";
const origin = "https://levi.local.test";
const input = {
  title: "Synthetic authorization",
  body: "Synthetic protected body",
};
const handlers = createSlideHandlers({
  getChurchAccess,
  repository: slideRepository,
  origin,
});
const list = createSlideListHandler({
  getChurchAccess,
  repository: slideListRepository,
});
async function fixture(admin = false) {
  const token = randomUUID();
  const user = {
    name: "Synthetic authorization",
    email: `${prefix}${randomUUID()}@example.invalid`,
  };
  if (admin) {
    const row = await prisma.adminUser.create({
      data: { ...user, status: "ACTIVE" },
    });
    await prisma.adminSession.create({
      data: {
        userId: row.id,
        token,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const cookie = `levi-admin-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, process.env.ADMIN_BETTER_AUTH_SECRET!)}`)}`;
    return { userId: row.id, cookie, churchId: null };
  }
  const church = await prisma.church.create({
    data: { name: `${prefix}${randomUUID()}` },
  });
  const row = await prisma.user.create({
    data: {
      ...user,
      actorState: "ACTIVE",
      churchMembership: { create: { churchId: church.id } },
    },
  });
  await prisma.session.create({
    data: { userId: row.id, token, expiresAt: new Date(Date.now() + 86400000) },
  });
  const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, process.env.BETTER_AUTH_SECRET!)}`)}`;
  return { userId: row.id, churchId: church.id, cookie };
}
async function matrix(cookie: string, id: string) {
  const request = (method: string, path = "", body?: unknown) =>
    new Request(`${origin}/api/church/slides${path}`, {
      method,
      headers: { cookie, origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return Promise.all([
    list(request("GET")),
    handlers.read(request("GET", `/${id}`), id),
    handlers.create(request("POST", "", input)),
    handlers.update(
      request("PUT", `/${id}`, { input, expectedRevision: 1 }),
      id,
    ),
    handlers.delete(request("DELETE", `/${id}`, { expectedRevision: 1 }), id),
  ]);
}
afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.church.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.adminUser.deleteMany({
    where: { email: { startsWith: prefix } },
  });
});
afterAll(() => prisma.$disconnect());

describe("real session authorization across Slide endpoints", () => {
  it.each(["suspended", "revoked", "password-change"] as const)(
    "denies every read and mutation for %s without changing saved content",
    async (state) => {
      const member = await fixture();
      expect(
        await getChurchAccess(new Headers({ cookie: member.cookie })),
      ).toMatchObject({ status: "authorized" });
      const slide = await prisma.slide.create({
        data: { ...input, churchId: member.churchId! },
      });
      if (state === "suspended")
        await prisma.church.update({
          where: { id: member.churchId! },
          data: { status: "SUSPENDED", suspendedAt: new Date() },
        });
      else if (state === "revoked")
        await prisma.session.deleteMany({ where: { userId: member.userId } });
      else
        await prisma.user.update({
          where: { id: member.userId },
          data: { mustChangePassword: true },
        });
      const responses = await matrix(member.cookie, slide.id);
      for (const response of responses) {
        expect(response.status).toBe(state === "revoked" ? 401 : 403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).not.toContain("Synthetic");
      }
      expect(
        await prisma.slide.findUnique({ where: { id: slide.id } }),
      ).toEqual(slide);
      expect(
        await prisma.slide.count({ where: { churchId: member.churchId! } }),
      ).toBe(1);
    },
  );
  it("a valid administrator session does not confer any church Slide capability", async () => {
    const admin = await fixture(true);
    expect(
      await getAdminSessionAccess(new Headers({ cookie: admin.cookie })),
    ).toMatchObject({ status: "authorized" });
    for (const response of await matrix(admin.cookie, randomUUID())) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: { code: "UNAUTHENTICATED" },
      });
    }
  });
});
