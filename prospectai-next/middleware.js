import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isOnboarding = createRouteMatcher(['/onboarding(.*)']);
const isAdmin = createRouteMatcher(['/admin(.*)']);
const isApiOrAsset = createRouteMatcher(['/_next(.*)', '/api(.*)','/(.*\\..*)']);

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default clerkMiddleware(async (auth, req) => {
  // Always allow static assets, API routes, and auth pages
  if (isPublicRoute(req) || isApiOrAsset(req)) return NextResponse.next();

  const { userId } = await auth();

  // Not logged in -- sign-in
  if (!userId) {
    const url = new URL('/sign-in', req.url);
    url.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(url);
  }

  // Admin route -- only allow the designated admin user
  if (isAdmin(req)) {
    const adminId = process.env.ADMIN_USER_ID;
    if (!adminId || userId !== adminId) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // Already on /onboarding -- let through
  if (isOnboarding(req)) return NextResponse.next();

  // Check onboarding status in Redis
  try {
    const [done, hasIcp, hasSenders] = await Promise.all([
      redis.get(`user:${userId}:onboarding_complete`),
      redis.get(`user:${userId}:icp_weights`),
      redis.get(`user:${userId}:sender_emails`),
    ]);
    // Consider complete if: explicit flag set OR they already have ICP/sender data
    const isComplete = done || hasIcp || hasSenders;
    if (!isComplete) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
  } catch (_) {
    // Redis unavailable -- fail open, don't block the user
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)','/(api|trpc)(.*)'],
};
