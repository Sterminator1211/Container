// Clear cookie and redirect to root
const { createClearTokenCookieHeader } = require('./_utils');

module.exports = async (req, res) => {
  const cookie = createClearTokenCookieHeader();
  res.setHeader('Set-Cookie', cookie);
  res.writeHead(302, { Location: '/' });
  res.end();
};