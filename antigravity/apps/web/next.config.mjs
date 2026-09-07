/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@antigravity/shared-types", "@antigravity/score-engine", "@antigravity/config"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
