import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emit a self-contained `.next/standalone` bundle (server.js + only the
  // node_modules actually traced) so the Docker runtime image stays small.
  output: 'standalone',
  serverExternalPackages: ['pg', 'simple-git', 'tiktoken'],
}

export default nextConfig
