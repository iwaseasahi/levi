import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/esm/**/*"],
  },
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;
