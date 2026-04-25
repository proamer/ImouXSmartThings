/**
 * Imou Access Token Manager
 *
 * Handles obtaining and caching the Imou Open Platform access token.
 * Tokens are automatically refreshed before expiry.
 *
 * API: POST {apiBase}/accessToken
 * Sign: md5("time:{time},nonce:{nonce},appSecret:{appSecret}")
 */

const axios = require('axios');
const config = require('../config');
const { generateSign } = require('../utils/crypto');
const logger = require('../utils/logger');

// In-memory token cache
let cachedToken = null;
let tokenExpireTime = 0;

// Buffer before expiry to refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get a valid Imou access token.
 * Returns cached token if still valid, otherwise fetches a new one.
 *
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if it's still valid (with buffer)
  if (cachedToken && now < tokenExpireTime - REFRESH_BUFFER_MS) {
    return cachedToken;
  }

  logger.info('Fetching new Imou access token...');

  const time = Math.floor(now / 1000);
  const { sign, nonce } = generateSign(time, config.imou.appSecret);

  try {
    const response = await axios.post(`${config.imou.apiBase}/accessToken`, {
      system: {
        ver: '1.0',
        appId: config.imou.appId,
        sign,
        time,
        nonce,
      },
      id: '1',
      params: {},
    });

    const result = response.data?.result;

    if (!result || result.code !== '0') {
      const errMsg = result?.msg || 'Unknown error';
      throw new Error(`Imou accessToken API error: ${errMsg} (code: ${result?.code})`);
    }

    const { accessToken, expireTime } = result.data;

    // Cache the token
    cachedToken = accessToken;
    // expireTime is in seconds (remaining), convert to absolute ms
    tokenExpireTime = Date.now() + (expireTime * 1000);

    logger.info('Imou access token obtained successfully', {
      expiresAt: new Date(tokenExpireTime).toISOString(),
    });

    return cachedToken;
  } catch (error) {
    logger.error('Failed to get Imou access token', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clear the cached token. Useful for forcing a refresh.
 */
function clearTokenCache() {
  cachedToken = null;
  tokenExpireTime = 0;
  logger.info('Imou token cache cleared');
}

module.exports = { getAccessToken, clearTokenCache };
