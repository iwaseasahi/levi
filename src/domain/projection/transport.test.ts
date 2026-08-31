import { describe, expect, it } from "vitest";
import {
  parseProjectionMessage,
  projectionEnvelope,
  projectionGeneration,
  trustedProjectionEvent,
  projectionArrow,
} from "./transport";
import { parseScriptureProjectionState } from "../scripture/projection-state";

const generation = "00000000-0000-4000-8000-000000000386";
const envelope = projectionEnvelope("slide", generation);
const state = {
  instance: generation,
  sequence: 1,
  presentation: { ready: true, authorized: true, fontScale: 1, blank: false },
  content: { page: 0 },
};
describe("projection v2 protocol", () => {
  it("accepts strict generation/kind-bound CONNECT, READY, ACK and bounded CONTROL", () => {
    for (const message of [
      { ...envelope, type: "HELLO", instance: generation },
      { ...envelope, type: "CONNECT", challenge: generation },
      { ...envelope, ...state, type: "READY", challenge: generation },
      { ...envelope, ...state, type: "ACK" },
      {
        ...envelope,
        type: "CONTROL",
        instance: generation,
        sequence: 1,
        command: { action: "select-page", page: 24999 },
      },
    ])
      expect(parseProjectionMessage(message)).toEqual(message);
  });
  it("rejects legacy, unknown, malformed, unbounded and extra fields", () => {
    const command = {
      ...envelope,
      type: "CONTROL",
      instance: generation,
      sequence: 1,
      command: { action: "next" },
    };
    for (const patch of [
      { version: 1 },
      { generation: "bad" },
      { instance: "bad" },
      { kind: "unknown" },
      { schema: "other" },
      { sequence: -1 },
      { sequence: 1.1 },
      { sequence: Infinity },
      { sequence: Number.MAX_SAFE_INTEGER + 1 },
      { extra: true },
      { command: { action: "next", page: 0 } },
      { command: { action: "select-page", page: -1 } },
      { command: { action: "select-page", page: 25000 } },
      { command: { action: "other" } },
    ])
      expect(parseProjectionMessage({ ...command, ...patch })).toBeNull();
    expect(
      parseProjectionMessage({
        schema: "levi.direct-audience",
        type: "READY",
        version: 1,
      }),
    ).toBeNull();
    for (const presentation of [
      { ...state.presentation, fontScale: 0.5 },
      { ...state.presentation, secret: "synthetic" },
    ])
      expect(
        parseProjectionMessage({
          ...envelope,
          ...state,
          type: "ACK",
          presentation,
        }),
      ).toBeNull();
  });
  it("requires both exact non-null source and origin", () => {
    const source = {} as Window;
    expect(
      trustedProjectionEvent(
        { source, origin: "https://levi.example" },
        "https://levi.example",
        source,
      ),
    ).toBe(true);
    expect(
      trustedProjectionEvent(
        { source, origin: "https://foreign.example" },
        "https://levi.example",
        source,
      ),
    ).toBe(false);
    expect(
      trustedProjectionEvent(
        { source: {} as Window, origin: "https://levi.example" },
        "https://levi.example",
        source,
      ),
    ).toBe(false);
    expect(
      trustedProjectionEvent(
        { source: null, origin: "https://levi.example" },
        "https://levi.example",
        null,
      ),
    ).toBe(false);
  });
  it("parses only the connection fragment without storing content", () => {
    expect(projectionGeneration(`#levi=${generation}`)).toBe(generation);
    for (const hash of [
      "",
      "#other=x",
      "#levi=bad",
      `#levi=${generation}&extra=x`,
    ])
      expect(projectionGeneration(hash)).toBeNull();
  });
  it("leaves content coordinates to the strict scripture adapter", () => {
    expect(parseScriptureProjectionState({ location: null })).toEqual({
      location: null,
    });
    const state = { location: { book: "GEN", chapter: 1, verse: 0 } };
    expect(parseScriptureProjectionState(state)).toEqual(state);
    for (const value of [
      { location: { book: "GEN", chapter: 0, verse: 1 } },
      { ...state, page: 1 },
      { location: { ...state.location, body: "synthetic" } },
      { page: 1 },
    ])
      expect(parseScriptureProjectionState(value)).toBeNull();
  });
  it("ignores modifiers, composition and non-arrow keys", () => {
    const event = {
      key: "ArrowDown",
      isComposing: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
    };
    expect(projectionArrow(event)).toBe("next");
    expect(projectionArrow({ ...event, key: "ArrowUp" })).toBe("previous");
    for (const patch of [
      { key: "Enter" },
      { isComposing: true },
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
    ])
      expect(projectionArrow({ ...event, ...patch })).toBeNull();
  });
});
