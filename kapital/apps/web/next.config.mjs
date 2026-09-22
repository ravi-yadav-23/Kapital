/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kapitl/shared-types", "@kapitl/score-engine", "@kapitl/config"],
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
