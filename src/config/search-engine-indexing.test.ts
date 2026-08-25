import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { metadata } from "../app/layout";
import robots from "../app/robots";
import {
  SEARCH_ENGINE_ROBOTS_HEADER,
  SEARCH_ENGINE_ROBOTS_METADATA,
  SEARCH_ENGINE_ROBOTS_RULES,
} from "./search-engine-indexing";

describe("search engine indexing policy", () => {
  it("marks every rendered page as non-indexable", () => {
    expect(metadata.robots).toEqual(SEARCH_ENGINE_ROBOTS_METADATA);
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    });
  });

  it("allows crawlers to read the noindex directive", () => {
    expect(robots()).toEqual({ rules: SEARCH_ENGINE_ROBOTS_RULES });
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
  });

  it("adds the non-indexing response header to every path", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toContainEqual({
      source: "/:path*",
      headers: [
        {
          key: "X-Robots-Tag",
          value: SEARCH_ENGINE_ROBOTS_HEADER,
        },
      ],
    });
  });
});
