import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    // Team logos are 2kratings SVGs served through the optimizer (2kratings
    // blocks hotlinking). Sandboxed CSP + attachment disposition per Next docs.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.microlink.io",
      },
      {
        protocol: "https",
        hostname: "www.2kratings.com",
      },
      {
        protocol: "https",
        hostname: "2kratings.com",
      },
    ],
  },
};

export default nextConfig;
