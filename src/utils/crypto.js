/**
 * Crypto Utilities for Imou API
 * Generates the MD5 sign required by all Imou Open Platform API calls.
 *
 * Sign formula: md5("time:{time},appId:{appId},appSecret:{appSecret}")
 * (as documented at https://open.imoulife.com/book/en/http/develop.html)
 */

const md5 = require('md5');

/**
 * Generate the `sign` parameter for Imou API requests.
 *
 * @param {number} time - Unix timestamp in seconds
 * @param {string} appId - Imou application ID
 * @param {string} appSecret - Imou application secret
 * @returns {string} MD5 hash string
 */
function generateSign(time, appId, appSecret) {
  const raw = `time:${time},appId:${appId},appSecret:${appSecret}`;
  return md5(raw);
}

module.exports = { generateSign };
