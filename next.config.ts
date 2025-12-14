import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sns-webpic-qc.xhscdn.com',
      },
      {
        protocol: 'https',
        hostname: 'ci.xiaohongshu.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/image/**',
      },
    ],
  },
}

export default nextConfig
