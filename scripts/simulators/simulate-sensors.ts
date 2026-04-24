#!/usr/bin/env tsx
/**
 * T036: IoT Sensor Simulator
 * Publishes zone occupancy readings every 30 seconds.
 * Simulates crowd build-up and redistribution after alerts.
 */

import { PubSub } from '@google-cloud/pubsub';

const PROJECT_ID = process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1';
const TOPIC = 'venue-sensor-events';
const EVENT_ID = `event-${new Date().toISOString().split('T')[0]}`;
const VENUE_CAPACITY = parseInt(process.env['SIMULATOR_VENUE_CAPACITY'] ?? '50000');

const pubsub = new PubSub({ projectId: PROJECT_ID });

const ZONES = [
  { id: 'zone-A', name: 'Main Entrance', capacity: 8000, sensorId: 'sensor-A-01' },
  { id: 'zone-B', name: 'Level 1 Concourse', capacity: 10000, sensorId: 'sensor-B-01' },
  { id: 'zone-C', name: 'VIP Lounge', capacity: 2000, sensorId: 'sensor-C-01' },
  { id: 'zone-D', name: 'Tunnel Walkway', capacity: 5000, sensorId: 'sensor-D-01' },
  { id: 'zone-E', name: 'East Stand', capacity: 12000, sensorId: 'sensor-E-01' },
  { id: 'zone-F', name: 'West Stand', capacity: 12000, sensorId: 'sensor-F-01' },
  { id: 'zone-G', name: 'North End', capacity: 7000, sensorId: 'sensor-G-01' },
  { id: 'zone-H', name: 'South End', capacity: 7000, sensorId: 'sensor-H-01' },
];

// Track current occupancy per zone (shared state across ticks)
const currentOccupancy: Record<string, number> = {};
ZONES.forEach((z) => { currentOccupancy[z.id] = 0; });

// Track active alerts to simulate redistribution
const zoneAlerted = new Set<string>();

function getTargetOccupancyPct(zoneId: string, elapsedMin: number): number {
  // Global fill level follows arrival curve
  const globalFill = elapsedMin < 60
    ? (elapsedMin / 60) * 0.85           // Ramp up to 85%
    : elapsedMin < 90
      ? 0.85 - ((elapsedMin - 60) / 30) * 0.1  // 85% → 75%
      : 0.75;                             // Steady state

  // Simulate redistribution: if zone alerted, attendees move to adjacent zones
  let zoneFactor = 1.0;
  if (zoneAlerted.has(zoneId)) {
    zoneFactor = 0.5; // Crowd evacuates
  } else if (zoneId === 'zone-B' && zoneAlerted.has('zone-A')) {
    zoneFactor = 1.3; // Overflow from zone A
  }

  // Add realistic noise
  const noise = (Math.random() - 0.5) * 0.08;
  return Math.min(100, Math.max(0, globalFill * zoneFactor * 100 + noise * 100));
}

async function publishSensorReading(zone: typeof ZONES[0], elapsedMin: number) {
  const targetPct = getTargetOccupancyPct(zone.id, elapsedMin);

  // Smooth movement: max 3% change per tick
  const current = currentOccupancy[zone.id] ?? 0;
  const delta = Math.min(3, Math.abs(targetPct - current)) * Math.sign(targetPct - current);
  const newPct = Math.min(100, Math.max(0, current + delta));
  currentOccupancy[zone.id] = newPct;

  // Mark critical zones for redistribution simulation
  if (newPct >= 85) {
    zoneAlerted.add(zone.id);
  } else if (newPct < 70) {
    zoneAlerted.delete(zone.id);
  }

  const headcount = Math.round((newPct / 100) * zone.capacity);

  await pubsub.topic(TOPIC).publishMessage({
    json: {
      zone_id: zone.id,
      timestamp: new Date().toISOString(),
      occupancy_pct: Math.round(newPct * 10) / 10,
      headcount,
      sensor_id: zone.sensorId,
      event_id: EVENT_ID,
    },
  });
}

async function run() {
  const startTime = Date.now();
  const durationMin = 180;

  console.info(`\n📡 IoT Sensor Simulator starting`);
  console.info(`   Project: ${PROJECT_ID} | Topic: ${TOPIC}`);
  console.info(`   Zones: ${ZONES.length} | Venue Capacity: ${VENUE_CAPACITY.toLocaleString()}\n`);

  const tick = async () => {
    const elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin > durationMin) {
      console.info('✅ Sensor simulation complete.');
      process.exit(0);
    }

    await Promise.allSettled(ZONES.map((z) => publishSensorReading(z, elapsedMin)));

    // Log a summary every 2.5 minutes
    if (Math.round(elapsedMin * 2) % 5 === 0) {
      const status = ZONES.map(
        (z) => `${z.id}:${Math.round(currentOccupancy[z.id] ?? 0)}%`,
      ).join(' | ');
      console.info(`   [${Math.round(elapsedMin)}min] ${status}`);
      if (zoneAlerted.size > 0) {
        console.info(`   ⚠️  Critical zones: ${[...zoneAlerted].join(', ')}`);
      }
    }

    setTimeout(() => void tick(), 30000); // Every 30 seconds
  };

  await tick();
}

void run().catch(console.error);
