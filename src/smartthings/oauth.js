/**
 * SmartThings Schema — OAuth 2.0 Authorization Server
 *
 * Implements the OAuth 2.0 Authorization Code Grant (RFC 6749)
 * required by SmartThings Schema Connector.
 *
 * Flow:
 * 1. SmartThings redirects user to GET /oauth/authorize
 * 2. User approves → server redirects back with authorization code
 * 3. SmartThings exchanges code for tokens via POST /oauth/token
 * 4. SmartThings refreshes tokens via POST /oauth/token (grant_type=refresh_token)
 *
 * Endpoints:
 * - GET  /oauth/authorize  — Authorization page (shows login/consent UI)
 * - POST /oauth/authorize  — Handle user approval
 * - POST /oauth/token      — Token exchange & refresh
 */

const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const {
  createAuthCode,
  consumeAuthCode,
  issueTokens,
  refreshTokens,
  ACCESS_TOKEN_LIFETIME,
} = require('../oauth/tokenStore');

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  GET /oauth/authorize — Authorization Page
// ═══════════════════════════════════════════════════════════

router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, state, scope } = req.query;

  logger.info('OAuth authorize request', {
    client_id,
    redirect_uri: redirect_uri?.substring(0, 60),
    response_type,
    scope,
  });

  // ── Validate request parameters ──
  if (!client_id || !redirect_uri || !response_type) {
    return res.status(400).send(renderErrorPage(
      'Missing Parameters',
      'Required: client_id, redirect_uri, response_type'
    ));
  }

  if (response_type !== 'code') {
    return res.status(400).send(renderErrorPage(
      'Unsupported Response Type',
      'Only "code" response type is supported (Authorization Code Grant).'
    ));
  }

  if (client_id !== config.oauth.clientId) {
    logger.warn('OAuth authorize: invalid client_id', { client_id });
    return res.status(400).send(renderErrorPage(
      'Invalid Client',
      'The client_id provided is not recognized.'
    ));
  }

  // ── Render authorization page ──
  res.send(renderAuthorizePage({ client_id, redirect_uri, state, scope }));
});

// ═══════════════════════════════════════════════════════════
//  POST /oauth/authorize — Handle User Approval
// ═══════════════════════════════════════════════════════════

router.post('/authorize', (req, res) => {
  const { client_id, redirect_uri, state, scope, action } = req.body;

  logger.info('OAuth authorize action', { action, client_id });

  if (action === 'deny') {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_description', 'User denied access');
    if (state) redirectUrl.searchParams.set('state', state);
    return res.redirect(redirectUrl.toString());
  }

  // action === 'approve'
  // Validate client_id
  if (client_id !== config.oauth.clientId) {
    return res.status(400).send(renderErrorPage('Invalid Client', 'Client ID mismatch.'));
  }

  // Generate authorization code
  const code = createAuthCode({
    clientId: client_id,
    redirectUri: redirect_uri,
    scope: scope || '',
    state: state || '',
  });

  // Redirect back to SmartThings with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  logger.info('OAuth: authorization granted, redirecting', {
    code: code.substring(0, 16) + '...',
    redirect: redirect_uri?.substring(0, 60),
  });

  return res.redirect(redirectUrl.toString());
});

// ═══════════════════════════════════════════════════════════
//  POST /oauth/token — Token Exchange & Refresh
// ═══════════════════════════════════════════════════════════

router.post('/token', (req, res) => {
  // Support both JSON body and form-urlencoded
  const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri } = req.body;

  logger.info('OAuth token request', { grant_type, client_id });

  // ── Validate client credentials ──
  if (!authenticateClient(client_id, client_secret)) {
    logger.warn('OAuth token: invalid client credentials', { client_id });
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication failed.',
    });
  }

  // ── Authorization Code Grant ──
  if (grant_type === 'authorization_code') {
    if (!code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing authorization code.',
      });
    }

    const codeData = consumeAuthCode(code, client_id);
    if (!codeData) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid, expired, or already used.',
      });
    }

    // Verify redirect_uri matches (RFC 6749 §4.1.3)
    if (redirect_uri && codeData.redirectUri !== redirect_uri) {
      logger.warn('OAuth token: redirect_uri mismatch');
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'redirect_uri does not match the authorization request.',
      });
    }

    const tokens = issueTokens(client_id, codeData.scope);
    logger.info('OAuth: tokens issued via authorization_code');
    return res.json(tokens);
  }

  // ── Refresh Token Grant ──
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing refresh_token.',
      });
    }

    const tokens = refreshTokens(refresh_token, client_id);
    if (!tokens) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid or expired.',
      });
    }

    logger.info('OAuth: tokens refreshed');
    return res.json(tokens);
  }

  // ── Unsupported Grant Type ──
  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: `Grant type "${grant_type}" is not supported. Use "authorization_code" or "refresh_token".`,
  });
});

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Authenticate client using client_id + client_secret.
 */
function authenticateClient(clientId, clientSecret) {
  return (
    clientId === config.oauth.clientId &&
    clientSecret === config.oauth.clientSecret
  );
}

/**
 * Render the authorization/consent page HTML.
 */
function renderAuthorizePage({ client_id, redirect_uri, state, scope }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Imou Camera</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, #0a0a1a 0%, #0f1629 40%, #1a1040 100%);
      color: #e0e0e0;
    }
    .card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 2.5rem;
      width: 100%;
      max-width: 440px;
      margin: 1rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .logo {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 0.5rem;
    }
    .logo h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .logo p {
      font-size: 0.8rem;
      color: #666;
      margin-top: 0.25rem;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      margin: 1.5rem 0;
    }
    .info {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #aaa;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .info strong {
      color: #4ecdc4;
    }
    .permissions {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .permissions h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 0.75rem;
    }
    .perm-item {
      display: flex;
      align-items: center;
      padding: 0.4rem 0;
      font-size: 0.85rem;
      color: #ccc;
    }
    .perm-item::before {
      content: '✓';
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(78,205,196,0.15);
      color: #4ecdc4;
      font-size: 0.7rem;
      margin-right: 0.75rem;
      flex-shrink: 0;
    }
    .buttons {
      display: flex;
      gap: 0.75rem;
    }
    .btn {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 10px;
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-approve {
      background: linear-gradient(135deg, #4ecdc4, #44a08d);
      color: #fff;
      box-shadow: 0 4px 15px rgba(78,205,196,0.3);
    }
    .btn-approve:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(78,205,196,0.45);
    }
    .btn-deny {
      background: rgba(255,255,255,0.06);
      color: #999;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .btn-deny:hover {
      background: rgba(255,59,48,0.1);
      color: #ff6b6b;
      border-color: rgba(255,59,48,0.3);
    }
    .footer {
      text-align: center;
      margin-top: 1.25rem;
      font-size: 0.7rem;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-icon">📷</span>
      <h1>Imou Camera</h1>
      <p>SmartThings Integration</p>
    </div>

    <div class="divider"></div>

    <p class="info">
      <strong>Samsung SmartThings</strong> is requesting access to control your Imou cameras.
    </p>

    <div class="permissions">
      <h3>This will allow SmartThings to:</h3>
      <div class="perm-item">View your camera list and status</div>
      <div class="perm-item">Access live stream and snapshots</div>
      <div class="perm-item">Control PTZ (pan/tilt/zoom)</div>
      <div class="perm-item">Receive motion detection events</div>
    </div>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}" />
      <input type="hidden" name="state" value="${escapeHtml(state || '')}" />
      <input type="hidden" name="scope" value="${escapeHtml(scope || '')}" />

      <div class="buttons">
        <button type="submit" name="action" value="deny" class="btn btn-deny">Deny</button>
        <button type="submit" name="action" value="approve" class="btn btn-approve">Authorize</button>
      </div>
    </form>

    <p class="footer">You can revoke access at any time from SmartThings settings.</p>
  </div>
</body>
</html>`;
}

/**
 * Render an error page.
 */
function renderErrorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — Imou Camera</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
      background: linear-gradient(160deg, #0a0a1a, #1a1040);
      color: #e0e0e0;
    }
    .card {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,59,48,0.2);
      border-radius: 20px;
      padding: 2.5rem;
      max-width: 420px;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.3rem; color: #ff6b6b; margin-bottom: 1rem; }
    p { font-size: 0.9rem; color: #999; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/**
 * Basic HTML escaping to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = router;
