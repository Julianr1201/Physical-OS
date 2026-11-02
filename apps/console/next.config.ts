import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@physical-os/ui'],
  async rewrites() {
    const api = process.env.PHYSICAL_OS_API_ORIGIN ?? 'http://127.0.0.1:4747';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
