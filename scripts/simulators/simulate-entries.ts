#!/usr/bin/env tsx
/**
 * T034: Gate Entry Simulator
 * Publishes realistic attendee entry events to venue-entry-events Pub/Sub topic.
 * Models crowd arrival curve: sparse → peak (first 60 min) → taper.
 */

import { PubSub } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

const PROJECT_ID = process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1';
const TOPIC = 'venue-entry-events';
const VENUE_CAPACITY = parseInt(process.env['SIMULATOR_VENUE_CAPACITY'] ?? '50000');
const GATE_COUNT = parseInt(process.env['SIMULATOR_GATE_COUNT'] ?? '24');
const ZONE_COUNT = parseInt(process.env['SIMULATOR_ZONE_COUNT'] ?? '8');
const EVENT_DURATION_MIN = parseInt(process.env['SIMULATOR_EVENT_DURATION_MIN'] ?? '180');
const EVENT_ID = `event-${new Date().toISOString().split('T')[0]}`;

const pubsub = new PubSub({ projectId: PROJECT_ID });

const ZONES = Array.from({ length: ZONE_COUNT }, (_, i) => `zone-${String.fromCharCode(65 + i)}`);
const GATES = Array.from({ length: GATE_COUNT }, (_, i) => `gate-${String(i + 1).padStart(2, '0')}`);

// Models a realistic stadium arrival curve:
//   0–60 min  : linear ramp from 20 to 320 arrivals/min (crowd builds before kick-off)
//   60–90 min : linear decay from 320 to 120 (peak entry wave subsides)
//   90+ min   : slow taper to 5 min (late arrivals only)
function getArrivalRate(elapsedMin: number): number {
  if (elapsedMin < 60) {
    return Math.floor((elapsedMin / 60) * 300 + 20); // 20 → 320 per minute
  } else if (elapsedMin < 90) {
    return Math.floor(320 - ((elapsedMin - 60) / 30) * 200); // 320 → 120
  } else {
    return Math.max(5, Math.floor(120 - ((elapsedMin - 90) / 90) * 115)); // 120 → 5
  }
}

async function publishEntryEvent(direction: 'IN' | 'OUT' = 'IN') {
  const gate = GATES[Math.floor(Math.random() * GATES.length)]!;
  const zone = ZONES[Math.floor(Math.random() * ZONES.length)]!;
  const attendeeHash = crypto.randomBytes(32).toString('hex');

  const payload = {
    gate_id: gate,
    timestamp: new Date().toISOString(),
    attendee_hash: attendeeHash,
    zone,
    event_id: EVENT_ID,
    direction,
  };

  const topic = pubsub.topic(TOPIC);
  await topic.publishMessage({ json: payload });
}

async function run() {
  const startTime = Date.now();
  const durationMs = EVENT_DURATION_MIN * 60 * 1000;

  console.info(`\n🏟️  Gate Entry Simulator starting`);
  console.info(`   Project: ${PROJECT_ID}`);
  console.info(`   Topic:   ${TOPIC}`);
  console.info(`   Event:   ${EVENT_ID}`);
  console.info(`   Duration: ${EVENT_DURATION_MIN} minutes`);
  console.info(`   Capacity: ${VENUE_CAPACITY.toLocaleString()} attendees\n`);

  let totalPublished = 0;

  const tick = async () => {
    const elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin > EVENT_DURATION_MIN) {
      console.info(`\n✅ Simulation complete. Total events published: ${totalPublished}`);
      process.exit(0);
    }

    const rate = getArrivalRate(elapsedMin);
    // 5% exits approximates mid-game departures (toilets, injuries, leaving early).
    const exitRate = Math.floor(rate * 0.05);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < rate; i++) {
      promises.push(publishEntryEvent('IN'));
    }
    for (let i = 0; i < exitRate; i++) {
      promises.push(publishEntryEvent('OUT'));
    }

    await Promise.allSettled(promises);
    totalPublished += rate + exitRate;

    if (Math.round(elapsedMin) % 5 === 0) {
      console.info(`   [${Math.round(elapsedMin)}min] Rate: ${rate}/min | Total: ${totalPublished}`);
    }

    setTimeout(() => void tick(), 1000); // Run every second, scaled
  };

  await tick();
}

void run().catch(console.error);
