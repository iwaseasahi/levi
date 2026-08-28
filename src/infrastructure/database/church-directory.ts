import { prisma } from "./client";

export interface ChurchDirectoryEntry {
  createdAt: Date;
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  user: {
    email: string;
    name: string;
    status: "ACTIVE" | "PENDING";
  } | null;
}

export async function listChurches(): Promise<ChurchDirectoryEntry[]> {
  const churches = await prisma.church.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      membership: {
        select: {
          user: {
            select: {
              actorState: true,
              email: true,
              name: true,
            },
          },
        },
      },
      name: true,
      status: true,
    },
  });

  return churches.map(({ membership, ...church }) => ({
    ...church,
    user: membership
      ? {
          email: membership.user.email,
          name: membership.user.name,
          status: membership.user.actorState,
        }
      : null,
  }));
}
