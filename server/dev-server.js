// Local dev entry point: runs the same Express app as a plain HTTP server so
// `vite`'s /api proxy (pointed at localhost:4001) keeps working unchanged.
// No database, no credentials needed — this is a stateless proxy.
const app = require('./src/app');

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`FX Macro API (dev) listening on http://localhost:${PORT}`);
});
