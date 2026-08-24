import { describe, expect, it } from "vitest";

import {
  canActorStartSession,
  type SessionActorRecord,
} from "./session-eligibility";

function actor(
  overrides: Partial<SessionActorRecord> = {},
): SessionActorRecord {
  return {
    actorState: "ACTIVE",
    churchMembership: null,
    ...overrides,
  };
}

describe("session actor eligibility", () => {
  it("allows active Church members", () => {
    expect(
      canActorStartSession(
        actor({
          churchMembership: { church: { status: "ACTIVE" } },
        }),
      ),
    ).toBe(true);
  });

  it("denies missing, pending, unassigned, and suspended actors", () => {
    expect(canActorStartSession(null)).toBe(false);
    expect(canActorStartSession(actor({ actorState: "PENDING" }))).toBe(false);
    expect(canActorStartSession(actor({ churchMembership: null }))).toBe(false);
    expect(
      canActorStartSession(
        actor({
          churchMembership: { church: { status: "SUSPENDED" } },
        }),
      ),
    ).toBe(false);
  });
});
