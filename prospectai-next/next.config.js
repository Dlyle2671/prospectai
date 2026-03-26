/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
        images: {
        domains: ['zenprospect-production.s3.amazonaws.com', 'apollo-server.com'],
            remotePatterns: [
        { protocol: 'https', hostname: '**.amazonaws.com' },
{ protocol: 'https', hostname: '**.apollo.io' },
        ],
    },
    };

// Clerk auth config
const clerkConfig = {
  ...nextConfig,
  env: {
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/',
  },
};

module.exports = clerkConfig;
