import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'simple-git', 'tiktoken'],
}

export default nextConfig
