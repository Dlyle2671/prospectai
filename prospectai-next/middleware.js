import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isOnboarding  = createRouteMatcher(['/onboarding(.*)']);
const isApiOrAsset  = createRouteMatcher(['/_next(.*)', '/api(.*)','/(.*\\..*)']);

const redis = new Redis({
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
});

export default clerkMiddleware(async (auth, req) => {
      // Always allow static assets, API routes, and auth pages
                                 if (isPublicRoute(req) || isApiOrAsset(req)) return NextResponse.next();

                                 const { userId } = await auth();

                                 // Not logged in → sign-in
                                 if (!userId) {
                                         const url = new URL('/sign-in', req.url);
                                         url.searchParams.set('redirect_url', req.url);
                                         return NextResponse.redirect(url);
                                 }

                                 // Already on /onboarding → let through
                                 if (isOnboarding(req)) return NextResponse.next();

                                 // Check onboarding status in Redis
                                 try {
                                         const [done, hasIcp, hasSenders] = await Promise.all([
                                                   redis.get(`user:${userId}:onboarding_complete`),
                                                   redis.get(`user:${userId}:icp_weights`),
                                                   redis.get(`user:${userId}:sender_emails`),
                                                 ]);

        // Consider complete if: explicit flag set OR they already have ICP/sender data
        // (handles existing users who signed up before onboarding was added)
        const isComplete = done || hasIcp || hasSenders;

        if (!isComplete) {
                  return NextResponse.redirect(new URL('/onboarding', req.url));
        }
                                 } catch (_) {
                                         // Redis unavailable — fail open, don't block the user
                                 }

                                 return NextResponse.next();
});

export const config = {
      matcher: ['/((?!_next|.*\\..*).*)','/(api|trpc)(.*)'],
};
