import { prisma } from "./client";

export interface ChurchDirectoryEntry {
  createdAt: Date;
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  users: Array<{
    id: string;
    email: string;
    name: string;
    status: "ACTIVE" | "PENDING";
  }>;
}

export async function listChurches(): Promise<ChurchDirectoryEntry[]> {
  const churches = await prisma.church.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      memberships: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          user: {
            select: {
              actorState: true,
              email: true,
              id: true,
              name: true,
            },
          },
        },
      },
      name: true,
      status: true,
    },
  });

  return churches.map(({ memberships, ...church }) => ({
    ...church,
    users: memberships.map(({ user }) => ({
      email: user.email,
      id: user.id,
      name: user.name,
      status: user.actorState,
    })),
  }));
}

export async function findChurchInvitationTarget(churchId: string) {
  return prisma.church.findFirst({
    select: { id: true, name: true },
    where: { id: churchId, status: "ACTIVE" },
  });
}
