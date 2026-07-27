const admin = require('firebase-admin');

if (!admin.apps.length) {
  // On Firebase Cloud Functions (and locally with the Firestore emulator)
  // ambient credentials are auto-detected. On other hosts (e.g. Vercel)
  // there's no ambient GCP identity, so FIREBASE_SERVICE_ACCOUNT — the full
  // service account JSON as a single env var — is used instead.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

const centralBanksCol = db.collection('central_banks');
const pairSignalsCol = db.collection('pair_signals');
const economicEventsCol = db.collection('economic_events');

function rateHistoryCol(bankId) {
  return centralBanksCol.doc(bankId).collection('rate_history');
}

module.exports = { admin, db, centralBanksCol, pairSignalsCol, economicEventsCol, rateHistoryCol };
