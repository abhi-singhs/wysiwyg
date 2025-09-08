import type { NextConfig } from 'next';

// Allow specifying repository subfolder for GitHub Pages e.g. /my-repo
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  assetPrefix: basePath || undefined,
  basePath: basePath || undefined,
};

export default nextConfig;
