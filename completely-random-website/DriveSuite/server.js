// Drive Suite - simple Express server with Google OAuth2 and Drive API
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { google } = require('googleapis');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI = 'http://localhost:3000/oauth2callback',
  SESSION_SECRET = 'change-this',
  PORT = 3000
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment.');
  console.error('Create OAuth credentials and set env vars, then restart.');
  process.exit(1);
}

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// OAuth2 client factory
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.readonly'
];

// Redirect user to Google consent page
app.get('/auth', (req, res) => {
  const oauth2Client = createOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // request refresh token
    prompt: 'consent',
    scope: SCOPES
  });
  res.redirect(authUrl);
});

// OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    // store tokens in session (in production use persistent DB)
    req.session.tokens = tokens;
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('Authentication error');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Middleware to ensure authenticated
async function ensureAuth(req, res, next) {
  if (!req.session.tokens) return res.status(401).json({ error: 'not_authenticated' });
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(req.session.tokens);
  // attach to request for handlers
  req.oauth2Client = oauth2Client;
  next();
}

// Get basic user info
app.get('/api/user', ensureAuth, async (req, res) => {
  try {
    const oauth2 = google.oauth2({ auth: req.oauth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    res.json(data);
  } catch (err) {
    console.error('Error fetching userinfo', err);
    res.status(500).json({ error: 'failed_userinfo' });
  }
});

// List files with optional search/filter/sort
app.get('/api/files', ensureAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });

    // Query parameters: q (search term), mimeType, sort, sortDir, pageSize
    const {
      q: searchTerm = '',
      fileType = 'all',
      sortBy = 'modifiedTime',
      sortDir = 'desc',
      pageSize = 50
    } = req.query;

    // Build Drive API q parameter
    const qParts = [];
    if (searchTerm) {
      // Search in filename and full text
      const clean = searchTerm.replace(/'/g, "\\'");
      qParts.push(`(name contains '${clean}' or fullText contains '${clean}')`);
    }

    // fileType filter mapping
    if (fileType && fileType !== 'all') {
      const typeMap = {
        documents: "mimeType = 'application/vnd.google-apps.document'",
        spreadsheets: "mimeType = 'application/vnd.google-apps.spreadsheet'",
        presentations: "mimeType = 'application/vnd.google-apps.presentation'",
        pdfs: "mimeType = 'application/pdf'",
        images: "mimeType contains 'image/'",
        folders: "mimeType = 'application/vnd.google-apps.folder'",
      };
      if (typeMap[fileType]) qParts.push(typeMap[fileType]);
    }

    // Do not show trashed files
    qParts.push('trashed = false');

    const q = qParts.join(' and ');

    // Build orderBy clause
    let orderBy = sortBy;
    if (sortDir && sortDir.toLowerCase() === 'desc') orderBy += ' desc';

    const response = await drive.files.list({
      pageSize: Number(pageSize),
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, owners)',
      q: q || undefined,
      orderBy
    });

    res.json({
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null
    });

  } catch (err) {
    console.error('Drive API error', err);
    res.status(500).json({ error: 'drive_error', details: err.message });
  }
});

// Fallback: serve index.html (front-end handles auth redirect)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Drive Suite listening on http://localhost:${PORT}`);
});