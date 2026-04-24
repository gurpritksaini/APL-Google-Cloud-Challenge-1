import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { bq, queuesCol, DATASET } from '../lib/firebase.js';
import { posEventSchema } from '../lib/schemas.js';

// T014: process-pos-event
// Trigger: Pub/Sub topic venue-pos-events
// Updates queue wait times in Firestore and logs to BigQuery.
export const processPosEvent = functions.pubsub.onMessagePublished(
  {
    topic: 'venue-pos-events',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const raw = Buffer.from(event.data.message.data, 'base64').toString('utf-8');
    const parsed = posEventSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      functions.logger.error('Invalid POS event payload', { errors: parsed.error.flatten() });
      return;
    }

    const payload = parsed.data;

    // ── 1. Upsert queue document in Firestore ───────────────
    await queuesCol().doc(payload.queue_id).set(
      {
        zone: payload.zone,
        queueType: payload.queue_type,
        waitMinutes: payload.wait_min,
        length: payload.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // ── 2. Write to BigQuery queue_events ───────────────────
    await bq
      .dataset(DATASET)
      .table('queue_events')
      .insert([
        {
          queue_id: payload.queue_id,
          timestamp: payload.timestamp,
          wait_min: payload.wait_min,
          length: payload.length,
          zone: payload.zone,
          queue_type: payload.queue_type,
          event_id: payload.event_id,
        },
      ]);

    functions.logger.info('POS event processed', {
      queue: payload.queue_id,
      zone: payload.zone,
      waitMin: payload.wait_min,
    });
  },
);
