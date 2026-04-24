/**
 * ImouXSmartThings — Local Server Entry Point
 *
 * Starts the Express server for local development.
 * On Vercel, the app is served via api/index.js instead.
 */

const config = require('./config');
const logger = require('./utils/logger');
const app = require('./app');

// ─── Start Server ─────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`🚀 ImouXSmartThings server running on port ${config.port}`);
  logger.info(`   Webhook URL: http://localhost:${config.port}/smartthings`);
  logger.info(`   OAuth URL:   http://localhost:${config.port}/oauth/authorize`);
  logger.info(`   Health:      http://localhost:${config.port}/health`);
  logger.info(`   Environment: ${config.nodeEnv}`);
});

module.exports = app;
