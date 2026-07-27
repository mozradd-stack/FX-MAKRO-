// Vercel serverless entry point. Reuses the same Express app that also runs
// locally (server/dev-server.js) — only the hosting wrapper differs, not the
// routes or the scoring logic.
module.exports = require('../server/src/app');
