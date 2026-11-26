import type { NextConfig } from 'next';

const apiOrigin = `http://127.0.0.1:${process.env.API_PORT || '3001'}`;

const nextConfig: NextConfig = {
  transpilePackages: ['@tuvitrina/contracts'],
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: '/docs',
        destination: `${apiOrigin}/docs`,
      },
      {
        source: '/docs/:path*',
        destination: `${apiOrigin}/docs/:path*`,
      },
    ];
  },
};

export default nextConfig;
