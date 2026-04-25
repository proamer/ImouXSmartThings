/**
 * Imou API HTTP Client
 *
 * Wraps all Imou Open Platform API calls with:
 * - Automatic access token injection
 * - Standard request envelope (system + params + id)
 * - Sign generation per request (with nonce)
 * - Error handling and logging
 *
 * All Imou APIs use POST method.
 * Base URL: https://openapi.easy4ip.com/openapi
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { generateSign } = require('../utils/crypto');
const { getAccessToken } = require('./auth');
const logger = require('../utils/logger');

// Create axios instance with defaults
const httpClient = axios.create({
  baseURL: config.imou.apiBase,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Call an Imou Open Platform API.
 *
 * @param {string} endpoint - API endpoint path (e.g., '/deviceOpenList')
 * @param {object} params - API-specific parameters
 * @returns {Promise<object>} The `result.data` from Imou API response
 * @throws {Error} If API returns non-zero error code
 *
 * @example
 * const devices = await callImouApi('/deviceOpenList', { pageSize: '50', page: '1' });
 */
async function callImouApi(endpoint, params = {}) {
  const accessToken = await getAccessToken();
  const time = Math.floor(Date.now() / 1000);
  const { sign, nonce } = generateSign(time, config.imou.appSecret);
  const requestId = uuidv4();

  const requestBody = {
    system: {
      ver: '1.0',
      appId: config.imou.appId,
      sign,
      time,
      nonce,
    },
    params: {
      ...params,
      token: accessToken,
    },
    id: requestId,
  };

  logger.debug(`Imou API call: ${endpoint}`, {
    requestId,
    params: Object.keys(params),
  });

  try {
    const response = await httpClient.post(endpoint, requestBody);
    const result = response.data?.result;

    if (!result) {
      throw new Error(`Imou API returned no result for ${endpoint}`);
    }

    if (result.code !== '0') {
      const error = new Error(`Imou API error: ${result.msg || 'Unknown'}`);
      error.code = result.code;
      error.endpoint = endpoint;
      throw error;
    }

    logger.debug(`Imou API success: ${endpoint}`, { requestId });

    return result.data;
  } catch (error) {
    if (error.code) {
      // Imou API error (already formatted)
      logger.error(`Imou API error on ${endpoint}`, {
        code: error.code,
        message: error.message,
        requestId,
      });
    } else {
      // Network or other error
      logger.error(`Imou API request failed: ${endpoint}`, {
        error: error.message,
        requestId,
      });
    }
    throw error;
  }
}

module.exports = { callImouApi };
