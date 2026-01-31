import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // 构建时忽略 ESLint 警告（仅错误会导致构建失败）
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // 让 Vercel serverless 函数包含 prompts 目录
  outputFileTracingIncludes: {
    '/api/**': ['./prompts/**/*'],
    '/creation': ['./prompts/**/*'],
    '/creation/**': ['./prompts/**/*'],
    '/**': ['./prompts/**/*'],
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
