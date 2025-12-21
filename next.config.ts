import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // 让 Vercel serverless 函数包含 prompts 目录
  outputFileTracingIncludes: {
    '/api/*': ['./prompts/**/*'],
    '/(dashboard)/*': ['./prompts/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sns-webpic-qc.xhscdn.com',
      },
      {
        protocol: 'https',
        hostname: 'sns-avatar-qc.xhscdn.com',
      },
      {
        protocol: 'https',
        hostname: 'ci.xiaohongshu.com',
      },
      {
        protocol: 'http',
        hostname: 'ci.xiaohongshu.com',
      },
      {
        protocol: 'https',
        hostname: 'ye.e-idear.com',
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
