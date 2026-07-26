const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const centralBanksCol = db.collection('central_banks');
const pairSignalsCol = db.collection('pair_signals');
const economicEventsCol = db.collection('economic_events');

function rateHistoryCol(bankId) {
  return centralBanksCol.doc(bankId).collection('rate_history');
}

module.exports = { admin, db, centralBanksCol, pairSignalsCol, economicEventsCol, rateHistoryCol };
