import type { NextConfig } from "next";

import { SEARCH_ENGINE_ROBOTS_HEADER } from "./src/config/search-engine-indexing";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: SEARCH_ENGINE_ROBOTS_HEADER,
          },
        ],
      },
    ];
  },
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/esm/**/*"],
  },
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;
