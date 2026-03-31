// /pages/api/auth/microsoft/index.js
// Redirects user to Microsoft OAuth login page

export default function handler(req, res) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = encodeURIComponent(
          process.env.NEXT_PUBLIC_BASE_URL
            ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/microsoft/callback`
            : 'https://prospectai-woad.vercel.app/api/auth/microsoft/callback'
        );
    const scope = encodeURIComponent('offline_access User.Read Mail.Send');
    const state = encodeURIComponent(req.query.returnTo || '/settings');

  const authUrl =
        `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
        `?client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${redirectUri}` +
        `&scope=${scope}` +
        `&state=${state}` +
        `&prompt=select_account`;

  res.redirect(authUrl);
}
