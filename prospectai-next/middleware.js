import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const isPublicRoute   = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isOnboarding    = createRouteMatcher(['/onboarding(.*)']);
const isApiOrAsset    = createRouteMatcher(['/_next(.*)', '/api(.*)','/(.*\\..*)', '/favicon.ico']);

const redis = new Redis({
    url:   process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

export default clerkMiddleware(async (auth, req) => {
    // Always allow public routes (sign-in / sign-up) and static assets
                                 if (isPublicRoute(req) || isApiOrAsset(req)) return NextResponse.next();

                                 const { userId } = await auth();

                                 // Not logged in → send to sign-in
                                 if (!userId) {
                                       const signInUrl = new URL('/sign-in', req.url);
                                       signInUrl.searchParams.set('redirect_url', req.url);
                                       return NextResponse.redirect(signInUrl);
                                 }

                                 // Already on /onboarding → let them through
                                 if (isOnboarding(req)) return NextResponse.next();

                                 // Check if the user has completed onboarding
                                 try {
                                       const done = await redis.get(`user:${userId}:onboarding_complete`);
                                       if (!done) {
                                               return NextResponse.redirect(new URL('/onboarding', req.url));
                                       }
                                 } catch (_) {
                                       // If Redis is unreachable, don't block the user — fail open
                                 }

                                 return NextResponse.next();
});

export const config = {
    matcher: ['/((?!_next|.*\\..*).*)','/(api|trpc)(.*)'],
};
