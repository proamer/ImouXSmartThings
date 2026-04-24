/**
 * ImouXSmartThings — Express App Definition
 *
 * A SmartThings Schema Connector webhook server that bridges
 * Imou camera API with Samsung SmartThings Cloud-to-Cloud integration.
 *
 * This module exports the Express app WITHOUT calling listen(),
 * so it can be used both locally (via index.js) and on Vercel (via api/index.js).
 *
 * Endpoints:
 * - POST /smartthings          — SmartThings webhook (discovery, stateRefresh, command)
 * - GET  /oauth/authorize      — OAuth2 authorization endpoint
 * - POST /oauth/authorize      — OAuth2 user approval
 * - POST /oauth/token          — OAuth2 token exchange endpoint
 * - GET  /health               — Health check endpoint
 */

const express = require('express');
const logger = require('./utils/logger');
const { router: smartthingsRouter } = require('./smartthings/webhook');
const oauthRouter = require('./smartthings/oauth');

const app = express();

// ─── Middleware ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ─── Routes ───────────────────────────────────────────

// SmartThings Schema webhook
app.use('/smartthings', smartthingsRouter);

// OAuth2 endpoints (required by SmartThings Schema)
app.use('/oauth', oauthRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'imou-x-smartthings',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root — basic info
app.get('/', (req, res) => {
  res.json({
    name: 'ImouXSmartThings Webhook Connector',
    version: '1.0.0',
    description: 'SmartThings Schema Connector for Imou cameras',
    endpoints: {
      webhook: 'POST /smartthings',
      oauth_authorize: 'GET /oauth/authorize',
      oauth_token: 'POST /oauth/token',
      health: 'GET /health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
