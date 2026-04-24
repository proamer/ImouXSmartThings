/**
 * SmartThings Schema — OAuth2 Placeholder Endpoints
 *
 * SmartThings Schema Connector requires OAuth2 endpoints for authentication.
 * These are placeholder implementations for development/testing.
 *
 * In production, replace these with a proper OAuth2 provider
 * (e.g., Auth0, Cognito, or your own OAuth server).
 *
 * Endpoints:
 * - GET  /oauth/authorize  — Authorization page
 * - POST /oauth/token       — Token exchange
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// Simple in-memory store for authorization codes
const authCodes = new Map();

/**
 * Authorization endpoint.
 * SmartThings redirects the user here during connector setup.
 *
 * In development: auto-approves and redirects back to SmartThings.
 */
router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state } = req.query;

  logger.info('OAuth authorization request received', {
    client_id,
    redirect_uri: redirect_uri?.substring(0, 50),
    response_type,
  });

  // Validate client_id
  if (client_id !== config.smartthings.clientId) {
    logger.warn('OAuth: invalid client_id');
    return res.status(400).send('Invalid client_id');
  }

  if (response_type !== 'code') {
    return res.status(400).send('Unsupported response_type. Expected: code');
  }

  // Generate an authorization code
  const code = uuidv4();
  authCodes.set(code, {
    client_id,
    redirect_uri,
    createdAt: Date.now(),
    // Code expires in 10 minutes
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // In development, auto-approve and redirect
  // In production, show a login/consent page here
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  logger.info('OAuth: auto-approving and redirecting', {
    code: code.substring(0, 8) + '...',
  });

  // Render a simple HTML page that auto-redirects
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Imou Camera Authorization</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
          color: #e0e0e0;
        }
        .card {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 420px;
        }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #fff; }
        p { margin-bottom: 1.5rem; line-height: 1.6; color: #aaa; }
        .btn {
          display: inline-block;
          padding: 12px 32px;
          background: linear-gradient(135deg, #4ecdc4, #44a08d);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(78, 205, 196, 0.4);
        }
        .spinner {
          border: 3px solid rgba(255,255,255,0.1);
          border-top: 3px solid #4ecdc4;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 1rem auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📷 Imou Camera</h1>
        <p>Authorizing access for SmartThings to your Imou cameras...</p>
        <div class="spinner"></div>
        <p style="font-size: 0.85rem;">Redirecting automatically...</p>
        <a href="${redirectUrl.toString()}" class="btn">Authorize</a>
      </div>
      <script>
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          window.location.href = "${redirectUrl.toString()}";
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

/**
 * Token exchange endpoint.
 * Exchanges authorization code for access + refresh tokens,
 * or refreshes an existing token.
 */
router.post('/token', (req, res) => {
  const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri } = req.body;

  logger.info('OAuth token request', { grant_type });

  // Validate client credentials
  if (client_id !== config.smartthings.clientId ||
      client_secret !== config.smartthings.clientSecret) {
    logger.warn('OAuth token: invalid client credentials');
    return res.status(401).json({ error: 'invalid_client' });
  }

  if (grant_type === 'authorization_code') {
    // Exchange authorization code for tokens
    const codeData = authCodes.get(code);

    if (!codeData || Date.now() > codeData.expiresAt) {
      logger.warn('OAuth token: invalid or expired authorization code');
      authCodes.delete(code);
      return res.status(400).json({ error: 'invalid_grant' });
    }

    // Clean up used code
    authCodes.delete(code);

    const accessToken = `imou-at-${uuidv4()}`;
    const refreshToken = `imou-rt-${uuidv4()}`;

    logger.info('OAuth token: issued new tokens');

    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours
    });
  }

  if (grant_type === 'refresh_token') {
    // Refresh the token
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const newAccessToken = `imou-at-${uuidv4()}`;
    const newRefreshToken = `imou-rt-${uuidv4()}`;

    logger.info('OAuth token: refreshed tokens');

    return res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 86400,
    });
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
});

module.exports = router;
