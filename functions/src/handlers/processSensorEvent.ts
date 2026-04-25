import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { bq, zonesCol, DATASET } from '../lib/firebase.js';
import { sensorEventSchema } from '../lib/schemas.js';
import { zoneStatus } from '../lib/logic.js';

// T015: process-sensor-event
// Trigger: Pub/Sub topic venue-sensor-events
// Updates zone density and status from IoT sensor readings.
export const processSensorEvent = functions.pubsub.onMessagePublished(
  {
    topic: 'venue-sensor-events',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const raw = Buffer.from(event.data.message.data, 'base64').toString('utf-8');
    const parsed = sensorEventSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      functions.logger.error('Invalid sensor event payload', { errors: parsed.error.flatten() });
      return;
    }

    const payload = parsed.data;

    const status = zoneStatus(payload.occupancy_pct);

    // ── 1. Update zone in Firestore ─────────────────────────
    await zonesCol().doc(payload.zone_id).set(
      {
        occupancyPct: Math.round(payload.occupancy_pct * 10) / 10,
        current: payload.headcount,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // ── 2. Write to BigQuery sensor_events ──────────────────
    await bq
      .dataset(DATASET)
      .table('sensor_events')
      .insert([
        {
          zone_id: payload.zone_id,
          timestamp: payload.timestamp,
          occupancy_pct: payload.occupancy_pct,
          headcount: payload.headcount,
          sensor_id: payload.sensor_id,
          event_id: payload.event_id,
        },
      ]);

    functions.logger.info('Sensor event processed', {
      zone: payload.zone_id,
      occupancy: payload.occupancy_pct,
      status,
    });
  },
);
