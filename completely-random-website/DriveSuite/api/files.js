// List Drive files with search/filter/sort (requires tokens cookie)
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
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const {
      q: searchTerm = '',
      fileType = 'all',
      sortBy = 'modifiedTime',
      sortDir = 'desc',
      pageSize = 50
    } = req.query || {};

    const qParts = [];
    if (searchTerm) {
      const clean = String(searchTerm).replace(/'/g, "\\'");
      qParts.push(`(name contains '${clean}' or fullText contains '${clean}')`);
    }

    if (fileType && fileType !== 'all') {
      const typeMap = {
        documents: "mimeType = 'application/vnd.google-apps.document'",
        spreadsheets: "mimeType = 'application/vnd.google-apps.spreadsheet'",
        presentations: "mimeType = 'application/vnd.google-apps.presentation'",
        pdfs: "mimeType = 'application/pdf'",
        images: "mimeType contains 'image/'",
        folders: "mimeType = 'application/vnd.google-apps.folder'"
      };
      if (typeMap[fileType]) qParts.push(typeMap[fileType]);
    }

    qParts.push('trashed = false');
    const q = qParts.join(' and ');

    let orderBy = sortBy;
    if (sortDir && sortDir.toLowerCase() === 'desc') orderBy += ' desc';

    const response = await drive.files.list({
      pageSize: Number(pageSize) || 50,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, owners)',
      q: q || undefined,
      orderBy
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null
    }));
  } catch (err) {
    console.error('files error', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'drive_error', details: err.message }));
  }
};