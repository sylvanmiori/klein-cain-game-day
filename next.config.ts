import type { NextConfig } from 'next';

const isGitHubPages = process.env.DEPLOY_TARGET !== 'cloudflare' && process.env.GITHUB_ACTIONS === 'true';
const repository = 'klein-cain-game-day';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  assetPrefix: isGitHubPages ? `/${repository}/` : '',
};

export default nextConfig;
