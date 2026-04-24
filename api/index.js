/**
 * Vercel Serverless Entry Point
 *
 * Re-exports the Express app as a Vercel serverless function.
 * All routes defined in src/index.js are handled here.
 */

const app = require('../src/app');

module.exports = app;
