// Handle OAuth2 callback, set encrypted token cookie, redirect to root
const { createOAuth2Client, createSetTokenCookieHeader } = require('./_utils');

module.exports = async (req, res) => {
  try {
    const { code, error } = req.query || {};
    if (error) {
      res.statusCode = 400;
      res.end('OAuth error: ' + String(error));
      return;
    }
    if (!code) {
      res.statusCode = 400;
      res.end('Missing code');
      return;
    }
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    // tokens contain access_token, refresh_token (if first consent), expiry_date, etc.
    // Set encrypted cookie
    const cookie = createSetTokenCookieHeader(tokens);
    res.setHeader('Set-Cookie', cookie);
    // Redirect home
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('oauth2callback error', err);
    res.statusCode = 500;
    res.end('OAuth callback error');
  }
};