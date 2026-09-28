import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "localhost"],
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;