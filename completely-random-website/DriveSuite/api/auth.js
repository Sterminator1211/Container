// Redirect to Google consent (serverless)
const { createOAuth2Client } = require('./_utils');

module.exports = async (req, res) => {
  try {
    const oauth2Client = createOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });
    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (err) {
    console.error('auth error', err);
    res.statusCode = 500;
    res.end('Auth error');
  }
};