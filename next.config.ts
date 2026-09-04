import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const repository = 'klein-cain-game-day';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? `/${repository}` : '',
  assetPrefix: isGitHubPages ? `/${repository}/` : '',
};

export default nextConfig;
