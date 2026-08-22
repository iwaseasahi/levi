import { describe, expect, it } from "vitest";
import {
  directAudienceSchema,
  directAudienceVersion,
  isTrustedDirectAudienceEvent,
  parseDirectAudienceCommand,
  parseDirectAudienceReady,
} from "./direct-audience-control";

describe("direct audience control protocol", () => {
  it("accepts only strict versioned control commands", () => {
    expect(
      parseDirectAudienceCommand({
        action: "font-larger",
        schema: directAudienceSchema,
        type: "CONTROL",
        version: directAudienceVersion,
      }),
    ).toMatchObject({ action: "font-larger" });
    expect(
      parseDirectAudienceCommand({
        action: "scroll-down",
        schema: directAudienceSchema,
        type: "CONTROL",
        version: directAudienceVersion,
      }),
    ).toBeNull();
    expect(
      parseDirectAudienceCommand({
        action: "next",
        extra: true,
        schema: directAudienceSchema,
        type: "CONTROL",
        version: directAudienceVersion,
      }),
    ).toBeNull();
  });

  it("accepts the exact ready envelope", () => {
    expect(
      parseDirectAudienceReady({
        schema: directAudienceSchema,
        type: "READY",
        version: directAudienceVersion,
      }),
    ).not.toBeNull();
    expect(
      parseDirectAudienceReady({
        schema: directAudienceSchema,
        type: "READY",
        version: 2,
      }),
    ).toBeNull();
  });

  it("requires the exact origin and window reference", () => {
    const expectedSource = {} as MessageEventSource;
    expect(
      isTrustedDirectAudienceEvent(
        { origin: "https://levi.example", source: expectedSource },
        "https://levi.example",
        expectedSource,
      ),
    ).toBe(true);
    expect(
      isTrustedDirectAudienceEvent(
        { origin: "https://evil.example", source: expectedSource },
        "https://levi.example",
        expectedSource,
      ),
    ).toBe(false);
    expect(
      isTrustedDirectAudienceEvent(
        { origin: "https://levi.example", source: {} as MessageEventSource },
        "https://levi.example",
        expectedSource,
      ),
    ).toBe(false);
  });
});
