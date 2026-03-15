/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
        images: {
        domains: ['zenprospect-production.s3.amazonaws.com', 'apollo-server.com'],
            remotePatterns: [
        { protocol: 'https', hostname: '**.amazonaws.com' },
{ protocol: 'https', hostname: '**.apollo.io' },
        ],
    },
    };

module.exports = nextConfig;
