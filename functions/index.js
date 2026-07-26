const { onRequest } = require('firebase-functions/v2/https');
const app = require('./src/app');

exports.api = onRequest({ region: 'us-central1' }, app);
