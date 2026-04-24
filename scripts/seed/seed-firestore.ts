#!/usr/bin/env tsx
/**
 * T037: Demo Seed Data
 * Pre-populates Firestore with venue layout, zones, queues, and a live event session.
 * Run: pnpm seed
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1',
  });
}

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

// ── Seed zones ───────────────────────────────────────────────
const ZONES = [
  { id: 'zone-A', name: 'Main Entrance', capacity: 8000, lat: -33.8688, lng: 151.2093 },
  { id: 'zone-B', name: 'Level 1 Concourse', capacity: 10000, lat: -33.8685, lng: 151.2098 },
  { id: 'zone-C', name: 'VIP Lounge', capacity: 2000, lat: -33.8690, lng: 151.2090 },
  { id: 'zone-D', name: 'Tunnel Walkway', capacity: 5000, lat: -33.8692, lng: 151.2095 },
  { id: 'zone-E', name: 'East Stand', capacity: 12000, lat: -33.8686, lng: 151.2100 },
  { id: 'zone-F', name: 'West Stand', capacity: 12000, lat: -33.8686, lng: 151.2086 },
  { id: 'zone-G', name: 'North End', capacity: 7000, lat: -33.8680, lng: 151.2093 },
  { id: 'zone-H', name: 'South End', capacity: 7000, lat: -33.8696, lng: 151.2093 },
];

// ── Seed queues ──────────────────────────────────────────────
const QUEUES = [
  { id: 'q-concession-a1', zone: 'zone-A', location: 'Gate A Concessions North', queueType: 'concession', waitMinutes: 3, length: 8 },
  { id: 'q-concession-a2', zone: 'zone-A', location: 'Gate A Concessions South', queueType: 'concession', waitMinutes: 5, length: 12 },
  { id: 'q-concession-b1', zone: 'zone-B', location: 'Level 1 Food Court', queueType: 'concession', waitMinutes: 12, length: 28 },
  { id: 'q-concession-c1', zone: 'zone-C', location: 'Premium Bar West', queueType: 'concession', waitMinutes: 2, length: 4 },
  { id: 'q-restroom-a1', zone: 'zone-A', location: 'Gate A Restrooms', queueType: 'restroom', waitMinutes: 4, length: 10 },
  { id: 'q-restroom-b1', zone: 'zone-B', location: 'Level 2 Restrooms', queueType: 'restroom', waitMinutes: 8, length: 18 },
  { id: 'q-restroom-d1', zone: 'zone-D', location: 'Tunnel Restrooms', queueType: 'restroom', waitMinutes: 2, length: 5 },
  { id: 'q-merch-main', zone: 'zone-B', location: 'Main Merch Store', queueType: 'merch', waitMinutes: 7, length: 15 },
];

// ── Seed alert scenarios ──────────────────────────────────────
const ALERTS = [
  {
    id: 'demo-alert-1',
    zone: 'zone-B',
    type: 'occupancy_warn',
    severity: 'warning',
    message: 'Level 1 Concourse is getting busy (73%). Consider using Level 2 instead.',
    triggeredAt: now,
    resolved: false,
    eventId: 'demo-event-2024',
  },
];

async function seed() {
  console.info('🌱 Seeding Firestore for demo...\n');

  // Zones
  const zoneBatch = db.batch();
  ZONES.forEach((zone) => {
    const { id, ...data } = zone;
    zoneBatch.set(db.collection('zones').doc(id), {
      ...data,
      current: Math.floor(data.capacity * 0.45),
      occupancyPct: 45,
      status: 'normal',
      updatedAt: now,
    });
  });
  await zoneBatch.commit();
  console.info(`✅ Seeded ${ZONES.length} zones`);

  // Queues
  const queueBatch = db.batch();
  QUEUES.forEach((queue) => {
    const { id, ...data } = queue;
    queueBatch.set(db.collection('queues').doc(id), { ...data, updatedAt: now });
  });
  await queueBatch.commit();
  console.info(`✅ Seeded ${QUEUES.length} queues`);

  // Alerts
  const alertBatch = db.batch();
  ALERTS.forEach((alert) => {
    const { id, ...data } = alert;
    alertBatch.set(db.collection('alerts').doc(id), data);
  });
  await alertBatch.commit();
  console.info(`✅ Seeded ${ALERTS.length} alerts`);

  // Current session
  await db.collection('sessions').doc('current').set({
    eventId: 'demo-event-2024',
    eventName: 'APL Grand Final — Demo Day',
    totalEntries: 28450,
    avgQueueMin: 6,
    totalAlerts: 1,
    criticalAlerts: 0,
    peakOccupancy: 73,
    lastUpdated: now,
  });
  console.info('✅ Seeded current session');

  // Current event
  await db.collection('events').doc('demo-event-2024').set({
    name: 'APL Grand Final — Demo Day',
    venue: 'Smart Venue Stadium',
    startTime: now,
    capacity: VENUE_CAPACITY,
    active: true,
  });
  console.info('✅ Seeded current event');

  console.info('\n🎉 Firestore seed complete! Ready for demo.\n');
}

const VENUE_CAPACITY = 50000;

void seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
