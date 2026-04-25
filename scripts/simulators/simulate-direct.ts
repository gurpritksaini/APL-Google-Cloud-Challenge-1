#!/usr/bin/env tsx
/**
 * Direct Firestore simulator — writes zones, queues, and session metrics
 * straight to Firestore without going through Pub/Sub or Cloud Functions.
 *
 * Run:
 *   pnpm simulate:live
 *
 * Uses the active `gcloud auth login` session — no ADC or service account needed.
 */

import * as admin from 'firebase-admin';

const PROJECT_ID = process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

// ── Zone definitions ─────────────────────────────────────────────────────────
const ZONES = [
  { id: 'zone-A', name: 'Main Entrance',     capacity: 8000  },
  { id: 'zone-B', name: 'Level 1 Concourse', capacity: 10000 },
  { id: 'zone-C', name: 'VIP Lounge',        capacity: 2000  },
  { id: 'zone-D', name: 'Tunnel Walkway',    capacity: 5000  },
  { id: 'zone-E', name: 'East Stand',        capacity: 12000 },
  { id: 'zone-F', name: 'West Stand',        capacity: 12000 },
  { id: 'zone-G', name: 'North End',         capacity: 7000  },
  { id: 'zone-H', name: 'South End',         capacity: 7000  },
];

// ── Queue definitions ────────────────────────────────────────────────────────
const QUEUES = [
  { id: 'q-concession-a1', zone: 'zone-A', location: 'Gate A Concessions North', queueType: 'concession' },
  { id: 'q-concession-a2', zone: 'zone-A', location: 'Gate A Concessions South', queueType: 'concession' },
  { id: 'q-concession-b1', zone: 'zone-B', location: 'Level 1 Food Court',       queueType: 'concession' },
  { id: 'q-concession-c1', zone: 'zone-C', location: 'Premium Bar West',         queueType: 'concession' },
  { id: 'q-restroom-a1',   zone: 'zone-A', location: 'Gate A Restrooms',         queueType: 'restroom'   },
  { id: 'q-restroom-b1',   zone: 'zone-B', location: 'Level 2 Restrooms',        queueType: 'restroom'   },
  { id: 'q-restroom-d1',   zone: 'zone-D', location: 'Tunnel Restrooms',         queueType: 'restroom'   },
  { id: 'q-merch-main',    zone: 'zone-B', location: 'Main Merch Store',         queueType: 'merch'      },
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
const clamp  = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const jitter = (v: number, range: number) => v + (Math.random() - 0.5) * 2 * range;
const spike  = (v: number, max: number) =>
  Math.random() < 0.1 ? clamp(v * (1.3 + Math.random() * 0.4), 0, max) : v;

function zoneStatus(pct: number): string {
  if (pct >= 85) return 'critical';
  if (pct >= 70) return 'warning';
  return 'normal';
}

// ── Write zones ──────────────────────────────────────────────────────────────
async function updateZones(): Promise<void> {
  const batch = db.batch();
  const now   = admin.firestore.Timestamp.now();

  for (const zone of ZONES) {
    const prev = zoneOccupancy[zone.id] ?? 50;
    const next = clamp(spike(jitter(prev, 4), 100), 0, 100);
    zoneOccupancy[zone.id] = next;

    batch.update(db.collection('zones').doc(zone.id), {
      occupancyPct: Math.round(next * 10) / 10,
      current:      Math.round((next / 100) * zone.capacity),
      status:       zoneStatus(next),
      updatedAt:    now,
    });
  }

  await batch.commit();
}

// ── Write queues ─────────────────────────────────────────────────────────────
async function updateQueues(): Promise<void> {
  const batch = db.batch();
  const now   = admin.firestore.Timestamp.now();

  for (const queue of QUEUES) {
    const state = queueState[queue.id] ?? { wait: 5, length: 10 };
    state.wait   = clamp(spike(jitter(state.wait, 2), 30), 0, 30);
    state.length = clamp(Math.round(jitter(state.length, 5)), 0, 60);

    batch.update(db.collection('queues').doc(queue.id), {
      waitMinutes: Math.round(state.wait * 10) / 10,
      length:      state.length,
      updatedAt:   now,
    });
  }

  await batch.commit();
}

// ── Write session metrics ─────────────────────────────────────────────────────
async function updateSession(): Promise<void> {
  totalEntries += Math.floor(Math.random() * 40 + 5);

  const avgWait  = Math.round(
    Object.values(queueState).reduce((s, q) => s + q.wait, 0) / QUEUES.length,
  );
  const peakOcc  = Math.round(Math.max(...Object.values(zoneOccupancy)));
  const alerts   = Object.values(zoneOccupancy).filter((p) => p >= 70).length;
  const critical = Object.values(zoneOccupancy).filter((p) => p >= 85).length;

  await db.collection('sessions').doc('current').update({
    totalEntries,
    avgQueueMin:    avgWait,
    peakOccupancy:  peakOcc,
    totalAlerts:    alerts,
    criticalAlerts: critical,
    lastUpdated:    admin.firestore.Timestamp.now(),
  });
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function runTick(): Promise<void> {
  tick++;
  await Promise.all([updateZones(), updateQueues()]);
  await updateSession();

  const zoneVals = Object.values(zoneOccupancy);
  const waitVals = Object.values(queueState).map((q) => q.wait);
  console.log(
    `[tick ${String(tick).padStart(3)}] ` +
    `zone: ${Math.min(...zoneVals).toFixed(0)}–${Math.max(...zoneVals).toFixed(0)}% | ` +
    `wait: ${Math.min(...waitVals).toFixed(0)}–${Math.max(...waitVals).toFixed(0)} min | ` +
    `entries: ${totalEntries.toLocaleString()}`,
  );
}

console.log(
  `\n🏟️  Direct Firestore simulator starting (15s ticks)\n` +
  `   Project : ${PROJECT_ID}\n` +
  `   Writing : zones, queues, sessions/current\n` +
  `   Ctrl+C to stop\n`,
);

void runTick();
const interval = setInterval(() => void runTick().catch(console.error), 15_000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\nSimulator stopped.');
  process.exit(0);
});
