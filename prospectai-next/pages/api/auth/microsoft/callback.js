// /pages/api/auth/microsoft/callback.js
// Exchanges OAuth code for tokens and stores them in Redis per-user

import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { userId } = getAuth(req);
    if (!userId) {
          return res.redirect('/sign-in');
    }

  const { code, state, error } = req.query;

  if (error) {
        console.error('Microsoft OAuth error:', error);
        return res.redirect('/settings?error=microsoft_auth_failed');
  }

  if (!code) {
        return res.redirect('/settings?error=no_code');
  }

  const redirectUri =
        process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/microsoft/callback`
          : 'https://prospectai-woad.vercel.app/api/auth/microsoft/callback';

  try {
        // Exchange code for tokens
      const tokenResponse = await fetch(
              'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                              client_id: process.env.MICROSOFT_CLIENT_ID,
                              client_secret: process.env.MICROSOFT_CLIENT_SECRET,
                              code,
                              redirect_uri: redirectUri,
                              grant_type: 'authorization_code',
                  }),
        }
            );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
              console.error('Token exchange error:', tokenData);
              return res.redirect('/settings?error=token_exchange_failed');
      }

      // Get user email from Microsoft Graph
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
        const profile = await profileRes.json();

      // Store tokens in Redis under this user's key
      const tokenPayload = {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expires_at: Date.now() + tokenData.expires_in * 1000,
              email: profile.mail || profile.userPrincipalName || '',
              display_name: profile.displayName || '',
      };

      await redis.set(`user:${userId}:microsoft_token`, JSON.stringify(tokenPayload));

      // Redirect back to settings with success
      const returnTo = state ? decodeURIComponent(state) : '/settings';
        res.redirect(`${returnTo}?microsoft=connected`);
  } catch (err) {
        console.error('Microsoft callback error:', err);
        res.redirect('/settings?error=microsoft_callback_error');
  }
}
