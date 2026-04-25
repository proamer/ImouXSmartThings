/**
 * Crypto Utilities for Imou API
 * Generates the MD5 sign required by all Imou Open Platform API calls.
 *
 * Sign formula: md5("time:{time},nonce:{nonce},appSecret:{appSecret}")
 * (as documented at https://open.imoulife.com/book/en/http/develop.html)
 *
 * The nonce must be a unique random string, not repeated within 5 minutes.
 * The sign must be a 32-bit lowercase hexadecimal string.
 */

const md5 = require('md5');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate the `sign` parameter and `nonce` for Imou API requests.
 *
 * @param {number} time - Unix timestamp in seconds
 * @param {string} appSecret - Imou application secret
 * @returns {{ sign: string, nonce: string }} The MD5 sign and nonce used
 */
function generateSign(time, appSecret) {
  const nonce = uuidv4();
  const raw = `time:${time},nonce:${nonce},appSecret:${appSecret}`;
  const sign = md5(raw);
  return { sign, nonce };
}

module.exports = { generateSign };
