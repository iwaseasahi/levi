import { describe, expect, it } from "vitest";
import {
  initialProjectionControlState,
  isTrustedProjectionEvent,
  parseAudienceProjectionMessage,
  parseControllerProjectionMessage,
  projectionSchema,
  projectionVersion,
  reduceAudienceConnection,
  reduceProjectionControl,
} from "./state";

describe("projection state and protocol", () => {
  it("bounds direct, previous, next, and font controls", () => {
    let state = reduceProjectionControl(
      initialProjectionControlState,
      { type: "previous" },
      3,
    );
    expect(state.currentIndex).toBe(0);
    state = reduceProjectionControl(state, { type: "select", index: 2 }, 3);
    state = reduceProjectionControl(state, { type: "next" }, 3);
    expect(state.currentIndex).toBe(2);
    for (let index = 0; index < 20; index += 1)
      state = reduceProjectionControl(state, { type: "font-larger" }, 3);
    expect(state.fontScale).toBe(2.2);
  });

  it("records scroll commands and blank state monotonically", () => {
    let state = reduceProjectionControl(
      initialProjectionControlState,
      { type: "scroll", direction: "down" },
      1,
    );
    state = reduceProjectionControl(state, { type: "toggle-blank" }, 1);
    expect(state).toMatchObject({
      blank: true,
      scrollDirection: "down",
      scrollRevision: 1,
    });
  });

  it("models block, connect, timeout, close, and reopen", () => {
    expect(reduceAudienceConnection("closed", "blocked")).toBe("blocked");
    expect(reduceAudienceConnection("blocked", "open")).toBe("opening");
    expect(reduceAudienceConnection("opening", "ready")).toBe("connected");
    expect(reduceAudienceConnection("connected", "timeout")).toBe(
      "disconnected",
    );
    expect(reduceAudienceConnection("disconnected", "closed")).toBe("closed");
  });

  it("accepts only exact versioned messages", () => {
    expect(
      parseAudienceProjectionMessage({
        schema: projectionSchema,
        version: projectionVersion,
        type: "READY",
      }),
    ).not.toBeNull();
    expect(
      parseAudienceProjectionMessage({
        schema: projectionSchema,
        version: 2,
        type: "READY",
      }),
    ).toBeNull();
    expect(
      parseAudienceProjectionMessage({
        schema: projectionSchema,
        version: projectionVersion,
        type: "READY",
        extra: true,
      }),
    ).toBeNull();
    expect(
      parseControllerProjectionMessage({
        schema: projectionSchema,
        version: projectionVersion,
        type: "STATE",
        payload: {},
      }),
    ).toBeNull();
  });

  it("requires both the expected origin and source window", () => {
    const source = {} as MessageEventSource;
    expect(
      isTrustedProjectionEvent(
        { origin: "https://levi.test", source },
        "https://levi.test",
        source,
      ),
    ).toBe(true);
    expect(
      isTrustedProjectionEvent(
        { origin: "https://evil.test", source },
        "https://levi.test",
        source,
      ),
    ).toBe(false);
    expect(
      isTrustedProjectionEvent(
        { origin: "https://levi.test", source: null },
        "https://levi.test",
        source,
      ),
    ).toBe(false);
  });
});
