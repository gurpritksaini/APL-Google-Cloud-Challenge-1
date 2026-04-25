#!/usr/bin/env tsx
/**
 * Live data simulator — publishes sensor and queue events to Pub/Sub topics
 * so the full pipeline (Pub/Sub → Cloud Functions → Firestore → PWA) is exercised.
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
 *   NEXT_PUBLIC_GCP_PROJECT_ID=apl--cloud-challenge-1 \
 *   pnpm tsx scripts/simulators/simulate-live-data.ts
 *
 * Cloud Functions (processSensorEvent, processPosEvent, evaluateZoneThresholds)
 * handle all Firestore writes — this script only publishes Pub/Sub messages.
 */

import { PubSub } from '@google-cloud/pubsub';
import * as admin from 'firebase-admin';

const PROJECT_ID = process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1';
const EVENT_ID = `event-${new Date().toISOString().split('T')[0]}`;

const pubsub = new PubSub({ projectId: PROJECT_ID });
const SENSOR_TOPIC = pubsub.topic('venue-sensor-events');
const POS_TOPIC = pubsub.topic('venue-pos-events');

// Direct Firestore write only for session metrics (no Cloud Function drives this in real-time)
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
const db = admin.firestore();

// ── Zone definitions ────────────────────────────────────────────────────────
const ZONES = [
  { id: 'zone-A', name: 'Main Entrance',     capacity: 8000,  sensorId: 'sensor-A-01' },
  { id: 'zone-B', name: 'Level 1 Concourse', capacity: 10000, sensorId: 'sensor-B-01' },
  { id: 'zone-C', name: 'VIP Lounge',        capacity: 2000,  sensorId: 'sensor-C-01' },
  { id: 'zone-D', name: 'Tunnel Walkway',    capacity: 5000,  sensorId: 'sensor-D-01' },
  { id: 'zone-E', name: 'East Stand',        capacity: 12000, sensorId: 'sensor-E-01' },
  { id: 'zone-F', name: 'West Stand',        capacity: 12000, sensorId: 'sensor-F-01' },
  { id: 'zone-G', name: 'North End',         capacity: 7000,  sensorId: 'sensor-G-01' },
  { id: 'zone-H', name: 'South End',         capacity: 7000,  sensorId: 'sensor-H-01' },
];

// ── Queue definitions ───────────────────────────────────────────────────────
const QUEUES = [
  { id: 'q-concession-a1', zone: 'zone-A', type: 'concession' as const },
  { id: 'q-concession-a2', zone: 'zone-A', type: 'concession' as const },
  { id: 'q-concession-b1', zone: 'zone-B', type: 'concession' as const },
  { id: 'q-concession-c1', zone: 'zone-C', type: 'concession' as const },
  { id: 'q-merch-main',    zone: 'zone-B', type: 'merch'      as const },
  { id: 'q-restroom-a1',   zone: 'zone-A', type: 'restroom'   as const },
  { id: 'q-restroom-b1',   zone: 'zone-B', type: 'restroom'   as const },
  { id: 'q-restroom-d1',   zone: 'zone-D', type: 'restroom'   as const },
];

// ── State ────────────────────────────────────────────────────────────────────
let tick = 0;
let totalEntries = 28450;

const zoneOccupancy: Record<string, number> = {
  'zone-A': 45, 'zone-B': 72, 'zone-C': 38,
  'zone-D': 55, 'zone-E': 68, 'zone-F': 61,
  'zone-G': 49, 'zone-H': 43,
};

const queueState: Record<string, { wait: number; length: number }> = {
  'q-concession-a1': { wait: 3,  length: 8  },
  'q-concession-a2': { wait: 5,  length: 12 },
  'q-concession-b1': { wait: 12, length: 28 },
  'q-concession-c1': { wait: 2,  length: 4  },
  'q-merch-main':    { wait: 7,  length: 15 },
  'q-restroom-a1':   { wait: 4,  length: 10 },
  'q-restroom-b1':   { wait: 8,  length: 18 },
  'q-restroom-d1':   { wait: 2,  length: 5  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const jitter = (v: number, range: number) => v + (Math.random() - 0.5) * 2 * range;
const spike  = (v: number, max: number)  =>
  Math.random() < 0.1 ? clamp(v * (1.3 + Math.random() * 0.4), 0, max) : v;

// ── Publish sensor events to venue-sensor-events → processSensorEvent ───────
async function publishSensorEvents(): Promise<void> {
  const now = new Date().toISOString();
  const messages = ZONES.map((zone) => {
    const prev = zoneOccupancy[zone.id] ?? 50;
    const next = clamp(spike(jitter(prev, 4), 100), 0, 100);
    zoneOccupancy[zone.id] = next;

    return SENSOR_TOPIC.publishMessage({
      json: {
        zone_id:       zone.id,
        timestamp:     now,
        occupancy_pct: Math.round(next * 10) / 10,
        headcount:     Math.round((next / 100) * zone.capacity),
        sensor_id:     zone.sensorId,
        event_id:      EVENT_ID,
      },
    });
  });
  await Promise.allSettled(messages);
}

// ── Publish queue snapshots to venue-pos-events → processPosEvent ───────────
async function publishQueueEvents(): Promise<void> {
  const now = new Date().toISOString();
  const messages = QUEUES.map((queue) => {
    const state = queueState[queue.id] ?? { wait: 5, length: 10 };
    state.wait   = clamp(spike(jitter(state.wait, 2), 30), 0, 30);
    state.length = clamp(Math.round(jitter(state.length, 5)), 0, 60);

    return POS_TOPIC.publishMessage({
      json: {
        queue_id:   queue.id,
        timestamp:  now,
        zone:       queue.zone,
        queue_type: queue.type,
        length:     state.length,
        wait_min:   Math.round(state.wait * 10) / 10,
        event_id:   EVENT_ID,
      },
    });
  });
  await Promise.allSettled(messages);
}

// ── Update session doc directly — aggregateSessionMetrics runs on 15-min schedule
async function updateSessionMetrics(): Promise<void> {
  totalEntries += Math.floor(Math.random() * 40 + 5);
  const avgWait = Math.round(
    Object.values(queueState).reduce((s, q) => s + q.wait, 0) / QUEUES.length,
  );
  const peakOcc = Math.round(Math.max(...Object.values(zoneOccupancy)));

  await db.collection('sessions').doc('current').set(
    {
      totalEntries,
      avgQueueMin:    avgWait,
      peakOccupancy:  peakOcc,
      totalAlerts:    Object.values(zoneOccupancy).filter((p) => p >= 70).length,
      criticalAlerts: Object.values(zoneOccupancy).filter((p) => p >= 85).length,
      lastUpdated:    admin.firestore.Timestamp.now(),
    },
    { merge: true },
  );
}

// ── Main loop ────────────────────────────────────────────────────────────────
async function updateAll(): Promise<void> {
  tick++;
  await publishSensorEvents();
  await publishQueueEvents();
  await updateSessionMetrics();

  const zoneVals  = Object.values(zoneOccupancy);
  const waitVals  = Object.values(queueState).map((q) => q.wait);
  console.log(
    `[tick ${String(tick).padStart(3)}] ` +
    `zone: ${Math.min(...zoneVals).toFixed(0)}–${Math.max(...zoneVals).toFixed(0)}% | ` +
    `wait: ${Math.min(...waitVals).toFixed(0)}–${Math.max(...waitVals).toFixed(0)} min | ` +
    `entries: ${totalEntries.toLocaleString()}`,
  );
}

console.log(
  `\n🏟️  Live simulator starting (30s ticks via Pub/Sub pipeline)\n` +
  `   Project: ${PROJECT_ID}\n` +
  `   Sensor topic : venue-sensor-events → Cloud Function: processSensorEvent\n` +
  `   Queue topic  : venue-pos-events    → Cloud Function: processPosEvent\n` +
  `   Alerts driven by evaluateZoneThresholds (Cloud Scheduler, 60s)\n` +
  `   Ctrl+C to stop\n`,
);

void updateAll();
const interval = setInterval(() => void updateAll().catch(console.error), 30_000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\nSimulator stopped.');
  process.exit(0);
});
