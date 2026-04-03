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
    // Always allow static assets and API routes
                                 if (isApiOrAsset(req)) return NextResponse.next();

                                 // If this is an invite link (__clerk_ticket in the URL), we must ensure
                                 // no existing session interferes. Sign out by clearing Clerk session cookies
                                 // and redirecting clean to the same URL so Clerk processes the ticket fresh.
                                 const url = new URL(req.url);
    const hasInviteTicket = url.searchParams.has('__clerk_ticket');

                                 if (hasInviteTicket) {
                                       const { userId } = await auth();
                                       if (userId) {
                                               // User is signed in - clear session and redirect to same URL
                                         // so the invite ticket is processed without an existing session
                                         const response = NextResponse.redirect(req.url);
                                               // Clear all Clerk session cookies so the browser arrives unauthenticated
                                         response.cookies.set('__session', '', { maxAge: 0, path: '/' });
                                               response.cookies.set('__client_uat', '', { maxAge: 0, path: '/' });
                                               return response;
                                       }
                                       // Not signed in - let Clerk handle the ticket normally
      return NextResponse.next();
                                 }

                                 // Allow public auth pages through
                                 if (isPublicRoute(req)) return NextResponse.next();

                                 const { userId } = await auth();

                                 // Not logged in -- redirect to sign-in
                                 if (!userId) {
                                       const signInUrl = new URL('/sign-in', req.url);
                                       signInUrl.searchParams.set('redirect_url', req.url);
                                       return NextResponse.redirect(signInUrl);
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
