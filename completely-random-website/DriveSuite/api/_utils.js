// Shared utilities for Vercel serverless functions
const { google } = require('googleapis');
const crypto = require('crypto');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
  SESSION_SECRET
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SESSION_SECRET || !REDIRECT_URI) {
  // We don't throw here because Vercel may load this module in build time; individual handlers verify too.
}

/* OAuth2 client factory */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/* Encryption helpers using AES-256-GCM */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // 96 bits for GCM

function getKey() {
  return crypto.createHash('sha256').update(String(SESSION_SECRET)).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

function decrypt(token) {
  try {
    const buf = Buffer.from(token, 'base64url');
    const iv = buf.slice(0, IV_LEN);
    const tag = buf.slice(IV_LEN, IV_LEN + 16);
    const ciphertext = buf.slice(IV_LEN + 16);
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return out.toString('utf8');
  } catch (err) {
    return null;
  }
}

/* Cookie helpers */
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, kv) => {
    const eq = kv.indexOf('=');
    if (eq === -1) return acc;
    const key = kv.slice(0, eq);
    const val = kv.slice(eq + 1);
    acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

function getTokensFromReq(req) {
  const cookies = parseCookies(req);
  const blob = cookies['ds_tokens'];
  if (!blob) return null;
  const json = decrypt(blob);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function createSetTokenCookieHeader(tokens) {
  const blob = encrypt(JSON.stringify(tokens));
  // cookie secure:true is fine on Vercel (HTTPS). HttpOnly, SameSite=Lax
  // 30 days max-age
  const maxAge = 60 * 60 * 24 * 30;
  const parts = [
    `ds_tokens=${encodeURIComponent(blob)}`,
    `Max-Age=${maxAge}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`
  ];
  return parts.join('; ');
}

function createClearTokenCookieHeader() {
  const parts = [
    `ds_tokens=deleted`,
    `Max-Age=0`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`
  ];
  return parts.join('; ');
}

module.exports = {
  createOAuth2Client,
  parseCookies,
  getTokensFromReq,
  createSetTokenCookieHeader,
  createClearTokenCookieHeader
};