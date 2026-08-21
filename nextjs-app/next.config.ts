import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/timesweet',
  serverExternalPackages: ['better-sqlite3'],
};



export default nextConfig;
