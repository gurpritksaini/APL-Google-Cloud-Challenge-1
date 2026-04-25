import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { db, bq, zonesCol, alertsCol, DATASET } from '../lib/firebase.js';
import type { ZoneDoc, AlertDoc } from '../lib/schemas.js';
import { alertMessage } from '../lib/logic.js';

const WARN_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 85;

// T016: evaluate-zone-thresholds
// Trigger: Cloud Scheduler every 60 seconds
// Reads all zones, creates/resolves alerts based on occupancy thresholds.
export const evaluateZoneThresholds = functions.scheduler.onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const [zonesSnap, activeAlertsSnap] = await Promise.all([
      zonesCol().get(),
      alertsCol().where('resolved', '==', false).get(),
    ]);

    const activeAlertsByZone = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    activeAlertsSnap.docs.forEach((doc) => {
      const data = doc.data() as AlertDoc;
      activeAlertsByZone.set(`${data.zone}:${data.type}`, doc);
    });

    const batch = db.batch();
    const bqRows: object[] = [];
    const now = admin.firestore.Timestamp.now();

    for (const zoneDoc of zonesSnap.docs) {
      const zone = zoneDoc.data() as ZoneDoc;
      const zoneId = zoneDoc.id;
      const pct = zone.occupancyPct ?? 0;

      const isCritical = pct >= CRITICAL_THRESHOLD;
      const isWarning = pct >= WARN_THRESHOLD && pct < CRITICAL_THRESHOLD;
      const alertType = isCritical
        ? 'occupancy_critical'
        : isWarning
          ? 'occupancy_warn'
          : null;

      if (alertType) {
        const alertKey = `${zoneId}:${alertType}`;
        if (!activeAlertsByZone.has(alertKey)) {
          // Create new alert
          const alertRef = alertsCol().doc();
          const severity = isCritical ? 'critical' : 'warning';
          const message = alertMessage(zone.name, pct, alertType);

          batch.set(alertRef, {
            zone: zoneId,
            type: alertType,
            severity,
            message,
            triggeredAt: now,
            resolved: false,
            eventId: zone.updatedAt?.toString() ?? '',
          } satisfies Omit<AlertDoc, 'resolvedAt'>);

          bqRows.push({
            alert_id: alertRef.id,
            zone: zoneId,
            type: alertType,
            severity,
            triggered_at: now.toDate().toISOString(),
            resolved_at: null,
            duration_min: null,
            event_id: '',
            fcm_sent: false,
          });

          functions.logger.warn('Alert created', { zone: zoneId, type: alertType, pct });
        }
      } else {
        // Zone back to normal — resolve any active alerts for this zone
        for (const [key, alertDocSnap] of activeAlertsByZone.entries()) {
          if (key.startsWith(`${zoneId}:`)) {
            const alertData = alertDocSnap.data() as AlertDoc;
            const durationMin =
              (now.toMillis() - (alertData.triggeredAt as admin.firestore.Timestamp).toMillis()) /
              60000;

            batch.update(alertDocSnap.ref, {
              resolved: true,
              resolvedAt: now,
            });

            bqRows.push({
              alert_id: alertDocSnap.id,
              zone: zoneId,
              type: alertData.type,
              severity: alertData.severity,
              triggered_at: (alertData.triggeredAt as admin.firestore.Timestamp)
                .toDate()
                .toISOString(),
              resolved_at: now.toDate().toISOString(),
              duration_min: Math.round(durationMin * 10) / 10,
              event_id: alertData.eventId,
              fcm_sent: false,
            });

            functions.logger.info('Alert resolved', { zone: zoneId, durationMin });
          }
        }
      }
    }

    await batch.commit();

    if (bqRows.length > 0) {
      await bq.dataset(DATASET).table('alert_events').insert(bqRows);
    }

    functions.logger.info('Zone threshold evaluation complete', {
      zonesChecked: zonesSnap.size,
      rowsWritten: bqRows.length,
    });
  },
);
