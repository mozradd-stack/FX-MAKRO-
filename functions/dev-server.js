// Local dev entry point: runs the same Express app as a plain HTTP server so
// `vite`'s /api proxy (pointed at localhost:4000) keeps working unchanged.
// Point FIRESTORE_EMULATOR_HOST at a running `firebase emulators:start
// --only firestore` (default localhost:8080) so this doesn't touch prod data.
const app = require('./src/app');

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`FX Macro API (dev) listening on http://localhost:${PORT}`);
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.warn('FIRESTORE_EMULATOR_HOST is not set — this will read/write the real Firestore project.');
  }
});
