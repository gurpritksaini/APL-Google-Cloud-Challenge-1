import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { db, bq, zonesCol, DATASET } from '../lib/firebase.js';
import { entryEventSchema } from '../lib/schemas.js';
import { zoneStatus } from '../lib/logic.js';

// T013: process-entry-event
// Trigger: Pub/Sub topic venue-entry-events (published by gate scanners)
// Updates zone occupancy in Firestore via a transaction to avoid race conditions
// from concurrent gate scans, then writes an immutable record to BigQuery for
// historical analysis. Malformed payloads are acked without retry to avoid
// poisoning the subscription.
export const processEntryEvent = functions.pubsub.onMessagePublished(
  {
    topic: 'venue-entry-events',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const raw = Buffer.from(event.data.message.data, 'base64').toString('utf-8');
    const parsed = entryEventSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      functions.logger.error('Invalid entry event payload', { errors: parsed.error.flatten() });
      return; // Returning without throwing acks the Pub/Sub message — prevents infinite retries.
    }

    const payload = parsed.data;
    const delta = payload.direction === 'IN' ? 1 : -1;

    // ── 1. Update Firestore zone occupancy ──────────────────
    const zoneRef = zonesCol().doc(payload.zone);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(zoneRef);
      if (!snap.exists) {
        functions.logger.warn('Zone not found', { zone: payload.zone });
        return;
      }

      const data = snap.data()!;
      const newCurrent = Math.max(0, (data['current'] as number) + delta);
      const newOccupancyPct =
        data['capacity'] > 0 ? (newCurrent / (data['capacity'] as number)) * 100 : 0;

      const status = zoneStatus(newOccupancyPct);

      tx.update(zoneRef, {
        current: newCurrent,
        occupancyPct: Math.round(newOccupancyPct * 10) / 10,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // ── 2. Write to BigQuery entry_events ───────────────────
    await bq
      .dataset(DATASET)
      .table('entry_events')
      .insert([
        {
          gate_id: payload.gate_id,
          timestamp: payload.timestamp,
          attendee_hash: payload.attendee_hash,
          zone: payload.zone,
          event_id: payload.event_id,
          direction: payload.direction,
        },
      ]);

    functions.logger.info('Entry event processed', {
      zone: payload.zone,
      direction: payload.direction,
      gate: payload.gate_id,
    });
  },
);
