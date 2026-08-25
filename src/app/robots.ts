import type { MetadataRoute } from "next";

import { SEARCH_ENGINE_ROBOTS_RULES } from "@/config/search-engine-indexing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: SEARCH_ENGINE_ROBOTS_RULES,
  };
}
