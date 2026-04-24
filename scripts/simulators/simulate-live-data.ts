#!/usr/bin/env tsx
/**
 * Live data simulator — directly updates Firestore so the UI shows real-time
 * changing queue times, zone occupancy, and session metrics.
 * Run: GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json pnpm tsx scripts/simulators/simulate-live-data.ts
 */

import * as admin from 'firebase-admin';

const PROJECT_ID = 'apl--cloud-challenge-1';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// ── Zone definitions ────────────────────────────────────────────────────────
const ZONES = [
  { id: 'zone-A', name: 'Main Entrance',    capacity: 8000  },
  { id: 'zone-B', name: 'Level 1 Concourse',capacity: 10000 },
  { id: 'zone-C', name: 'VIP Lounge',       capacity: 2000  },
  { id: 'zone-D', name: 'Tunnel Walkway',   capacity: 5000  },
  { id: 'zone-E', name: 'East Stand',       capacity: 12000 },
  { id: 'zone-F', name: 'West Stand',       capacity: 12000 },
  { id: 'zone-G', name: 'North End',        capacity: 7000  },
  { id: 'zone-H', name: 'South End',        capacity: 7000  },
];

// ── Queue definitions ───────────────────────────────────────────────────────
const QUEUES = [
  { id: 'q-concession-a1', zone: 'zone-A', location: 'Gate A Concessions North', queueType: 'concession' },
  { id: 'q-concession-a2', zone: 'zone-A', location: 'Gate A Concessions South', queueType: 'concession' },
  { id: 'q-concession-b1', zone: 'zone-B', location: 'Level 1 Food Court',       queueType: 'concession' },
  { id: 'q-concession-c1', zone: 'zone-C', location: 'Premium Bar West',         queueType: 'concession' },
  { id: 'q-merch-main',    zone: 'zone-B', location: 'Main Merch Store',         queueType: 'merch'      },
  { id: 'q-restroom-a1',   zone: 'zone-A', location: 'Gate A Restrooms',         queueType: 'restroom'   },
  { id: 'q-restroom-b1',   zone: 'zone-B', location: 'Level 2 Restrooms',        queueType: 'restroom'   },
  { id: 'q-restroom-d1',   zone: 'zone-D', location: 'Tunnel Restrooms',         queueType: 'restroom'   },
];

// ── State ────────────────────────────────────────────────────────────────────
let tick = 0;
let totalEntries = 28450;

// Baseline wait minutes per queue (drifts realistically)
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

const zoneState: Record<string, number> = {
  'zone-A': 45, 'zone-B': 72, 'zone-C': 38,
  'zone-D': 55, 'zone-E': 68, 'zone-F': 61,
  'zone-G': 49, 'zone-H': 43,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function jitter(val: number, range: number): number {
  return val + (Math.random() - 0.5) * 2 * range;
}

// Occasional spike: 10% chance per queue per tick
function maybeSpike(val: number, max: number): number {
  if (Math.random() < 0.1) return clamp(val * (1.3 + Math.random() * 0.4), 0, max);
  return val;
}

function zoneStatus(pct: number): 'normal' | 'warning' | 'critical' {
  if (pct >= 85) return 'critical';
  if (pct >= 70) return 'warning';
  return 'normal';
}

// ── Main update ──────────────────────────────────────────────────────────────
async function updateAll() {
  tick++;
  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // ── Queues ────────────────────────────────────────────────────────────────
  for (const q of QUEUES) {
    const s = queueState[q.id]!;

    // Drift wait time ±1.5 min, spike occasionally, keep in [1, 25]
    s.wait  = clamp(Math.round(jitter(maybeSpike(s.wait, 25), 1.5)), 1, 25);
    s.length = clamp(Math.round(s.wait * 2.2 + Math.random() * 3), 1, 60);

    batch.update(db.collection('queues').doc(q.id), {
      waitMinutes: s.wait,
      length: s.length,
      updatedAt: now,
    });
  }

  // ── Zones ─────────────────────────────────────────────────────────────────
  let totalCurrent = 0;
  for (const z of ZONES) {
    let pct = zoneState[z.id]!;

    // Slow drift ±2%, occasional spike ±8%, clamp 10–95%
    pct = clamp(jitter(pct, 2), 10, 95);
    if (Math.random() < 0.08) pct = clamp(pct + (Math.random() - 0.3) * 16, 10, 95);
    pct = Math.round(pct * 10) / 10;
    zoneState[z.id] = pct;

    const current = Math.round((pct / 100) * z.capacity);
    totalCurrent += current;

    batch.update(db.collection('zones').doc(z.id), {
      occupancyPct: pct,
      current,
      status: zoneStatus(pct),
      updatedAt: now,
    });
  }

  // ── Session metrics ───────────────────────────────────────────────────────
  totalEntries += Math.floor(Math.random() * 40 + 5); // 5–45 new entries per tick
  const avgWait = Math.round(
    Object.values(queueState).reduce((s, q) => s + q.wait, 0) / QUEUES.length
  );
  const peakOcc = Math.round(Math.max(...Object.values(zoneState)));
  const activeAlerts = Object.values(zoneState).filter(p => p >= 70).length;

  batch.update(db.collection('sessions').doc('current'), {
    totalEntries,
    avgQueueMin: avgWait,
    peakOccupancy: peakOcc,
    totalAlerts: activeAlerts,
    criticalAlerts: Object.values(zoneState).filter(p => p >= 85).length,
    lastUpdated: now,
  });

  // ── Alerts ────────────────────────────────────────────────────────────────
  // Auto-create / resolve alerts based on zone thresholds
  for (const z of ZONES) {
    const pct = zoneState[z.id]!;
    const alertId = `auto-alert-${z.id}`;
    const alertRef = db.collection('alerts').doc(alertId);

    if (pct >= 85) {
      batch.set(alertRef, {
        zone: z.id,
        type: 'occupancy_critical',
        severity: 'critical',
        message: `${z.name} is critically full (${Math.round(pct)}%). Use alternate entrances.`,
        triggeredAt: now,
        resolved: false,
        eventId: 'demo-event-2024',
      }, { merge: true });
    } else if (pct >= 70) {
      batch.set(alertRef, {
        zone: z.id,
        type: 'occupancy_warn',
        severity: 'warning',
        message: `${z.name} is getting busy (${Math.round(pct)}%). Consider using alternate zones.`,
        triggeredAt: now,
        resolved: false,
        eventId: 'demo-event-2024',
      }, { merge: true });
    } else {
      // Resolve alert if zone cleared up
      batch.set(alertRef, { resolved: true }, { merge: true });
    }
  }

  await batch.commit();

  const waitVals = Object.values(queueState).map(q => q.wait);
  const zoneVals = Object.values(zoneState);
  console.log(
    `[tick ${String(tick).padStart(3)}] entries: ${totalEntries.toLocaleString()} | ` +
    `queues: ${Math.min(...waitVals)}–${Math.max(...waitVals)} min | ` +
    `zones: ${Math.min(...zoneVals).toFixed(0)}–${Math.max(...zoneVals).toFixed(0)}% | ` +
    `alerts: ${activeAlerts}`
  );
}

// ── Run loop ─────────────────────────────────────────────────────────────────
console.log(`\n🏟️  Live data simulator running (updates every 3s)\n   Project: ${PROJECT_ID}\n   Ctrl+C to stop\n`);

void updateAll();
const interval = setInterval(() => void updateAll().catch(console.error), 3000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\nSimulator stopped.');
  process.exit(0);
});
