// Shared Firebase Admin SDK and BigQuery singletons for all Cloud Functions.
// Exported collection helpers centralise Firestore path strings so a rename
// only needs to happen in one place.

import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

// The Functions runtime reuses the same Node.js process across warm invocations,
// so guard against calling initializeApp() more than once.
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const messaging = admin.messaging();
export const bq = new BigQuery();

export const DATASET = process.env.BIGQUERY_DATASET ?? 'venue_analytics';
// GCLOUD_PROJECT is injected automatically by the Cloud Functions runtime;
// the fallback empty string will fail loudly in BigQuery queries, which is intentional.
export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? '';

// ── Firestore collection helpers ────────────────────────────
export const zonesCol = () => db.collection('zones');
export const queuesCol = () => db.collection('queues');
export const alertsCol = () => db.collection('alerts');
export const sessionsCol = () => db.collection('sessions');
export const eventsCol = () => db.collection('events');
