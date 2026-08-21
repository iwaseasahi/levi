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
    platformOperator: { userId: "operator-id" },
    ...overrides,
  };
}

describe("session actor eligibility", () => {
  it("allows active operators and active Church members", () => {
    expect(canActorStartSession(actor())).toBe(true);
    expect(
      canActorStartSession(
        actor({
          churchMembership: { church: { status: "ACTIVE" } },
          platformOperator: null,
        }),
      ),
    ).toBe(true);
  });

  it("denies missing, pending, unassigned, and suspended actors", () => {
    expect(canActorStartSession(null)).toBe(false);
    expect(canActorStartSession(actor({ actorState: "PENDING" }))).toBe(false);
    expect(
      canActorStartSession(
        actor({ churchMembership: null, platformOperator: null }),
      ),
    ).toBe(false);
    expect(
      canActorStartSession(
        actor({
          churchMembership: { church: { status: "SUSPENDED" } },
          platformOperator: null,
        }),
      ),
    ).toBe(false);
  });
});
