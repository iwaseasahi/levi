export interface SessionActorRecord {
  actorState: "ACTIVE" | "PENDING";
  churchMembership: { church: { status: "ACTIVE" | "SUSPENDED" } } | null;
}

export function canActorStartSession(actor: SessionActorRecord | null) {
  if (!actor || actor.actorState !== "ACTIVE") {
    return false;
  }

  return actor.churchMembership?.church.status === "ACTIVE";
}
