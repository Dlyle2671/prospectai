/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
      output: 'standalone',
        images: {
    domains: ['zenprospect-production.s3.amazonaws.com', 'apollo-server.com'],
          remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
{ protocol: 'https', hostname: '**.apollo.io' },
      ],
  },
  };

module.exports = nextConfig;
