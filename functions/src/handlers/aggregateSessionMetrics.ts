import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { bq, sessionsCol, DATASET, PROJECT_ID } from '../lib/firebase.js';

// T018: aggregate-session-metrics
// Trigger: Cloud Scheduler every 15 minutes
// Runs a cross-table BigQuery query over the last 24 hours to produce rolling
// KPIs (peak occupancy, avg queue wait, total entries, alert counts) and writes
// them back to /sessions/current in Firestore — the document the home page
// dashboard listens to in real-time. Also snapshots the metrics to BigQuery's
// session_metrics table for historical reporting.
export const aggregateSessionMetrics = functions.scheduler.onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  async () => {
    const sessionSnap = await sessionsCol().doc('current').get();
    if (!sessionSnap.exists) {
      functions.logger.warn('No current session found — skipping metrics aggregation');
      return;
    }

    const session = sessionSnap.data()!;
    const eventId: string = session['eventId'] ?? 'unknown';

    // The 1-DAY window covers a full event day regardless of start time.
    // For multi-day events this query would need scoping to the current session's
    // startTime — acceptable for the current single-day demo scope.
    const query = `
      WITH zone_metrics AS (
        SELECT
          MAX(occupancy_pct) AS peak_occupancy
        FROM \`${PROJECT_ID}.${DATASET}.sensor_events\`
        WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
      ),
      queue_metrics AS (
        SELECT
          AVG(wait_min) AS avg_queue_min
        FROM \`${PROJECT_ID}.${DATASET}.queue_events\`
        WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
      ),
      entry_metrics AS (
        SELECT
          COUNT(*) AS total_entries
        FROM \`${PROJECT_ID}.${DATASET}.entry_events\`
        WHERE direction = 'IN'
          AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
      ),
      alert_metrics AS (
        SELECT
          COUNT(*) AS total_alerts,
          COUNTIF(severity = 'critical') AS critical_alerts
        FROM \`${PROJECT_ID}.${DATASET}.alert_events\`
        WHERE triggered_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
      )
      SELECT
        zm.peak_occupancy,
        qm.avg_queue_min,
        em.total_entries,
        am.total_alerts,
        am.critical_alerts
      FROM zone_metrics zm, queue_metrics qm, entry_metrics em, alert_metrics am
    `;

    const [rows] = await bq.query({ query, location: 'US' });
    const metrics = rows[0] as {
      peak_occupancy: number | null;
      avg_queue_min: number | null;
      total_entries: number | null;
      total_alerts: number | null;
      critical_alerts: number | null;
    };

    const now = admin.firestore.Timestamp.now();

    await sessionsCol().doc('current').set(
      {
        eventId,
        peakOccupancy: metrics.peak_occupancy ?? 0,
        avgQueueMin: metrics.avg_queue_min ?? 0,
        totalEntries: metrics.total_entries ?? 0,
        totalAlerts: metrics.total_alerts ?? 0,
        criticalAlerts: metrics.critical_alerts ?? 0,
        lastUpdated: now,
      },
      { merge: true },
    );

    // Also write snapshot to BigQuery session_metrics
    await bq
      .dataset(DATASET)
      .table('session_metrics')
      .insert([
        {
          session_id: eventId,
          event_date: now.toDate().toISOString().split('T')[0],
          event_name: session['eventName'] ?? null,
          peak_occupancy: metrics.peak_occupancy ?? 0,
          avg_queue_min: metrics.avg_queue_min ?? 0,
          total_entries: metrics.total_entries ?? 0,
          total_alerts: metrics.total_alerts ?? 0,
          critical_alerts: metrics.critical_alerts ?? 0,
          snapshot_time: now.toDate().toISOString(),
        },
      ]);

    functions.logger.info('Session metrics aggregated', {
      eventId,
      peakOccupancy: metrics.peak_occupancy,
      avgQueueMin: metrics.avg_queue_min,
    });
  },
);
