export interface SessionActorRecord {
  actorState: "ACTIVE" | "PENDING";
  churchMembership: { church: { status: "ACTIVE" | "SUSPENDED" } } | null;
  platformOperator: { userId: string } | null;
}

export function canActorStartSession(actor: SessionActorRecord | null) {
  if (!actor || actor.actorState !== "ACTIVE") {
    return false;
  }

  if (actor.platformOperator) {
    return true;
  }

  return actor.churchMembership?.church.status === "ACTIVE";
}
