/**
 * SmartThings Schema — Webhook Router
 *
 * Main entry point for all SmartThings Cloud-to-Cloud requests.
 * Routes incoming requests by `interactionType` to the appropriate handler.
 *
 * Interaction types:
 * - discoveryRequest → discovery.js
 * - stateRefreshRequest → stateRefresh.js
 * - commandRequest → command.js
 * - grantCallbackAccess → stores callback credentials
 * - interactionResult → logs results
 */

const express = require('express');
const { handleDiscovery } = require('./discovery');
const { handleStateRefresh } = require('./stateRefresh');
const { handleCommand } = require('./command');
const logger = require('../utils/logger');

const router = express.Router();

// In-memory callback access token storage
// In production, persist this to a database
const callbackCredentials = {};

/**
 * Main SmartThings webhook endpoint.
 * All ST Schema interactions are sent here as POST requests.
 */
router.post('/', async (req, res) => {
  const body = req.body;
  const headers = body?.headers || {};
  const interactionType = headers.interactionType;
  const requestId = headers.requestId;

  logger.info(`SmartThings webhook received: ${interactionType}`, {
    requestId,
    schema: headers.schema,
  });

  try {
    let response;

    switch (interactionType) {
      // ━━━ Discovery ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'discoveryRequest':
        response = await handleDiscovery(requestId);
        break;

      // ━━━ State Refresh ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'stateRefreshRequest':
        response = await handleStateRefresh(requestId, body.devices || []);
        break;

      // ━━━ Command ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'commandRequest':
        response = await handleCommand(requestId, body.devices || []);
        break;

      // ━━━ Grant Callback Access ━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'grantCallbackAccess': {
        const callbackAuth = body.callbackAuthentication || {};
        callbackCredentials.accessToken = callbackAuth.accessToken;
        callbackCredentials.refreshToken = callbackAuth.refreshToken;
        callbackCredentials.expiresIn = callbackAuth.expiresIn;
        callbackCredentials.tokenType = callbackAuth.tokenType;
        callbackCredentials.callbackUrl =
          body.callbackUrls?.stateCallback ||
          body.callbackUrls?.oauthToken;

        logger.info('Callback access granted', {
          hasAccessToken: !!callbackAuth.accessToken,
          callbackUrl: callbackCredentials.callbackUrl,
        });

        response = {
          headers: {
            schema: 'st-schema',
            version: '1.0',
            interactionType: 'grantCallbackAccess',
            requestId,
          },
        };
        break;
      }

      // ━━━ Interaction Result ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'interactionResult': {
        const result = body.interactionResult || {};
        logger.info('Interaction result received', {
          requestId: result.requestId,
          interactionType: result.interactionType,
          statusCode: result.statusCode,
        });

        response = {
          headers: {
            schema: 'st-schema',
            version: '1.0',
            interactionType: 'interactionResult',
            requestId,
          },
        };
        break;
      }

      // ━━━ Unknown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      default:
        logger.warn(`Unknown interaction type: ${interactionType}`);
        response = {
          headers: {
            schema: 'st-schema',
            version: '1.0',
            interactionType: 'interactionResult',
            requestId,
          },
          globalError: {
            code: 'UNSUPPORTED_INTERACTION',
            detail: `Interaction type "${interactionType}" is not supported`,
          },
        };
    }

    logger.debug('SmartThings webhook response', {
      interactionType: response?.headers?.interactionType,
    });

    return res.json(response);
  } catch (error) {
    logger.error('SmartThings webhook handler error', {
      interactionType,
      requestId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      headers: {
        schema: 'st-schema',
        version: '1.0',
        interactionType: 'interactionResult',
        requestId,
      },
      globalError: {
        code: 'INTERNAL_ERROR',
        detail: error.message,
      },
    });
  }
});

/**
 * Get the stored callback credentials.
 * Used for proactive state updates.
 */
function getCallbackCredentials() {
  return { ...callbackCredentials };
}

module.exports = { router, getCallbackCredentials };
