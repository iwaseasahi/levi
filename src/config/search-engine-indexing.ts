export const SEARCH_ENGINE_ROBOTS_HEADER =
  "noindex, nofollow, noarchive" as const;

export const SEARCH_ENGINE_ROBOTS_METADATA = {
  index: false,
  follow: false,
  noarchive: true,
  noimageindex: true,
} as const;

export const SEARCH_ENGINE_ROBOTS_RULES = {
  userAgent: "*",
  allow: "/",
} as const;
