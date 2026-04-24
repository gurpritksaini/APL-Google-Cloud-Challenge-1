import * as admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

// Initialise once — Firebase Functions runtime reuses the same instance
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const messaging = admin.messaging();
export const bq = new BigQuery();

export const DATASET = process.env.BIGQUERY_DATASET ?? 'venue_analytics';
export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? '';

// ── Firestore collection helpers ────────────────────────────
export const zonesCol = () => db.collection('zones');
export const queuesCol = () => db.collection('queues');
export const alertsCol = () => db.collection('alerts');
export const sessionsCol = () => db.collection('sessions');
export const eventsCol = () => db.collection('events');
