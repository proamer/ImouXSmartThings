/**
 * Application Configuration
 * Loads environment variables and exports typed config object.
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Imou Open Platform
  imou: {
    appId: process.env.IMOU_APP_ID || '',
    appSecret: process.env.IMOU_APP_SECRET || '',
    apiBase: process.env.IMOU_API_BASE || 'https://openapi.easy4ip.com/openapi',
  },

  // SmartThings
  smartthings: {
    clientId: process.env.ST_CLIENT_ID || '',
    clientSecret: process.env.ST_CLIENT_SECRET || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
  },

  // OAuth2 Server (for SmartThings Schema Connector)
  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    scope: process.env.OAUTH_SCOPE || 'imou:cameras',
  },
};

// Validate required config on startup
function validateConfig() {
  const missing = [];
  if (!config.imou.appId) missing.push('IMOU_APP_ID');
  if (!config.imou.appSecret) missing.push('IMOU_APP_SECRET');

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing environment variables: ${missing.join(', ')}\n` +
      `   Copy .env.example to .env and fill in the values.`
    );
  }
}

validateConfig();

module.exports = config;
