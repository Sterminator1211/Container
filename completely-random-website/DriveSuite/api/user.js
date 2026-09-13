// Return user info (requires valid encrypted tokens cookie)
const { google } = require('googleapis');
const { getTokensFromReq, createOAuth2Client } = require('./_utils');

module.exports = async (req, res) => {
  try {
    const tokens = getTokensFromReq(req);
    if (!tokens) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not_authenticated' }));
      return;
    }
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('user error', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'user_error' }));
  }
};