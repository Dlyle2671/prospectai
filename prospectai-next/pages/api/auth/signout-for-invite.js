import { clerkClient, getAuth } from '@clerk/nextjs/server';

/**
 * GET /api/auth/signout-for-invite?redirect_url=<invite_url>
  *
   * Signs out the currently authenticated user server-side (invalidates their
    * Clerk session), then redirects them to the invite URL so Clerk can process
     * the __clerk_ticket without an existing session interfering.
      *
       * This is called by middleware.js when an authenticated user hits a
        * __clerk_ticket URL (invite link). Clearing cookies alone is insufficient
         * because Clerk v5 client-side JS can re-hydrate the session from its own
          * internal state. Using clerkClient.sessions.revokeSession ensures the
           * session is truly invalidated on the Clerk backend.
            */
            export default async function handler(req, res) {
              const { userId, sessionId } = getAuth(req);
                const redirectUrl = req.query.redirect_url || '/sign-up';

                  // Safety: only allow redirecting to our own domain
                    let safeRedirect = redirectUrl;
                      try {
                          const parsed = new URL(redirectUrl);
                              const appHost = process.env.NEXT_PUBLIC_APP_URL
                                    ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
                                          : null;
                                              if (appHost && parsed.host !== appHost) {
                                                    safeRedirect = '/sign-up';
                                                        }
                                                          } catch {
                                                              safeRedirect = '/sign-up';
                                                                }

                                                                  if (userId && sessionId) {
                                                                      try {
                                                                            const client = await clerkClient();
                                                                                  await client.sessions.revokeSession(sessionId);
                                                                                      } catch (err) {
                                                                                            // If revocation fails, proceed anyway - the redirect will still clear
                                                                                                  // the session cookie on the response
                                                                                                        console.error('Failed to revoke session:', err);
                                                                                                            }
                                                                                                              }
                                                                                                              
                                                                                                                // Redirect to the invite URL; set Clerk session cookies to expired
                                                                                                                  // as a belt-and-suspenders measure alongside the backend revocation
                                                                                                                    res.setHeader('Set-Cookie', [
                                                                                                                        '__session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
                                                                                                                            '__client_uat=; Max-Age=0; Path=/; Secure; SameSite=Lax',
                                                                                                                                '__clerk_db_jwt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
                                                                                                                                  ]);
                                                                                                                                    res.redirect(302, safeRedirect);
                                                                                                                                    }
