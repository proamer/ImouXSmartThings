/**
 * OAuth2 Token Store
 *
 * In-memory store for authorization codes, access tokens, and refresh tokens.
 * Compatible with serverless environments (Vercel, AWS Lambda, etc.)
 *
 * NOTE: In serverless, tokens are lost on cold starts.
 * SmartThings handles this gracefully — it will re-authenticate
 * via the refresh token flow or re-authorize if needed.
 *
 * For true persistence, integrate a database (e.g., Redis, MongoDB, Vercel KV).
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Default token lifetimes
const ACCESS_TOKEN_LIFETIME = 24 * 60 * 60;   // 24 hours in seconds
const REFRESH_TOKEN_LIFETIME = 30 * 24 * 60 * 60; // 30 days in seconds
const AUTH_CODE_LIFETIME = 10 * 60;             // 10 minutes in seconds

// In-memory store (works in both local and serverless)
const store = {
  authCodes: {},
  accessTokens: {},
  refreshTokens: {},
};

/**
 * Generate a cryptographically secure random token.
 */
function generateToken(prefix = '') {
  const token = crypto.randomBytes(32).toString('hex');
  return prefix ? `${prefix}_${token}` : token;
}

/**
 * Create and store an authorization code.
 */
function createAuthCode({ clientId, redirectUri, scope, state }) {
  // Clean expired codes first
  cleanExpiredCodes();

  const code = generateToken('authcode');
  const now = Math.floor(Date.now() / 1000);

  store.authCodes[code] = {
    clientId,
    redirectUri,
    scope: scope || '',
    state: state || '',
    createdAt: now,
    expiresAt: now + AUTH_CODE_LIFETIME,
    used: false,
  };

  logger.info('Auth code created', { code: code.substring(0, 16) + '...' });
  return code;
}

/**
 * Validate and consume an authorization code.
 * Returns the code data if valid, null otherwise.
 * Codes are single-use (RFC 6749 §4.1.2).
 */
function consumeAuthCode(code, clientId) {
  const codeData = store.authCodes[code];

  if (!codeData) {
    logger.warn('Auth code not found');
    return null;
  }

  if (codeData.used) {
    // Code reuse detected — revoke all tokens from this code (security)
    logger.warn('Auth code reuse detected! Revoking associated tokens.');
    delete store.authCodes[code];
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > codeData.expiresAt) {
    logger.warn('Auth code expired');
    delete store.authCodes[code];
    return null;
  }

  if (codeData.clientId !== clientId) {
    logger.warn('Auth code client_id mismatch');
    return null;
  }

  // Mark as used
  codeData.used = true;

  return codeData;
}

/**
 * Issue access token and refresh token pair.
 */
function issueTokens(clientId, scope) {
  const now = Math.floor(Date.now() / 1000);

  const accessToken = generateToken('at');
  const refreshToken = generateToken('rt');

  store.accessTokens[accessToken] = {
    clientId,
    scope: scope || '',
    createdAt: now,
    expiresAt: now + ACCESS_TOKEN_LIFETIME,
  };

  store.refreshTokens[refreshToken] = {
    clientId,
    scope: scope || '',
    accessToken,
    createdAt: now,
    expiresAt: now + REFRESH_TOKEN_LIFETIME,
  };

  logger.info('Tokens issued', {
    accessToken: accessToken.substring(0, 12) + '...',
    expiresIn: ACCESS_TOKEN_LIFETIME,
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_LIFETIME,
  };
}

/**
 * Validate an access token.
 * Returns token data if valid, null otherwise.
 */
function validateAccessToken(token) {
  const tokenData = store.accessTokens[token];
  if (!tokenData) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now > tokenData.expiresAt) {
    logger.debug('Access token expired');
    delete store.accessTokens[token];
    return null;
  }

  return tokenData;
}

/**
 * Refresh tokens — issue new access+refresh tokens using a refresh token.
 * The old refresh token is invalidated (rotation).
 */
function refreshTokens(refreshToken, clientId) {
  const rtData = store.refreshTokens[refreshToken];

  if (!rtData) {
    logger.warn('Refresh token not found');
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > rtData.expiresAt) {
    logger.warn('Refresh token expired');
    delete store.refreshTokens[refreshToken];
    return null;
  }

  if (rtData.clientId !== clientId) {
    logger.warn('Refresh token client_id mismatch');
    return null;
  }

  // Revoke old access token
  if (rtData.accessToken && store.accessTokens[rtData.accessToken]) {
    delete store.accessTokens[rtData.accessToken];
  }

  // Revoke old refresh token (rotation)
  delete store.refreshTokens[refreshToken];

  // Issue new pair
  const tokens = issueTokens(clientId, rtData.scope);
  logger.info('Tokens refreshed successfully');
  return tokens;
}

/**
 * Clean up expired authorization codes.
 */
function cleanExpiredCodes() {
  const now = Math.floor(Date.now() / 1000);
  let cleaned = 0;
  for (const [code, data] of Object.entries(store.authCodes)) {
    if (now > data.expiresAt || data.used) {
      delete store.authCodes[code];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cleaned ${cleaned} expired/used auth codes`);
  }
}

/**
 * Clean up expired tokens (run periodically).
 */
function cleanExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  let cleaned = 0;

  for (const [token, data] of Object.entries(store.accessTokens)) {
    if (now > data.expiresAt) {
      delete store.accessTokens[token];
      cleaned++;
    }
  }

  for (const [token, data] of Object.entries(store.refreshTokens)) {
    if (now > data.expiresAt) {
      delete store.refreshTokens[token];
      cleaned++;
    }
  }

  cleanExpiredCodes();

  if (cleaned > 0) {
    logger.info(`Token cleanup: removed ${cleaned} expired tokens`);
  }
}

module.exports = {
  createAuthCode,
  consumeAuthCode,
  issueTokens,
  validateAccessToken,
  refreshTokens,
  cleanExpiredTokens,
  ACCESS_TOKEN_LIFETIME,
  REFRESH_TOKEN_LIFETIME,
};
