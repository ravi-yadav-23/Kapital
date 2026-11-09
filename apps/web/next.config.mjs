/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.platform !== 'win32' || process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '817266880199-0gilousjp4gnrbve1tli77db7c5v62oo.apps.googleusercontent.com',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rawApiUrl = process.env.API_URL || 'http://127.0.0.1:8000';
    const base = rawApiUrl.replace(/\/$/, '');
    const destination = base.endsWith('/api') ? `${base}/:path*` : `${base}/api/:path*`;
    return [
      {
        source: '/api/:path*',
        destination,
      },
    ];
  },
};

export default nextConfig;
