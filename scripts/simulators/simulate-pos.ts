#!/usr/bin/env tsx
/**
 * T035: POS / Queue Simulator
 * Publishes queue events at realistic intervals.
 * Models concession rush at half-time / quarter-time marks.
 */

import { PubSub } from '@google-cloud/pubsub';

const PROJECT_ID = process.env['NEXT_PUBLIC_GCP_PROJECT_ID'] ?? 'apl--cloud-challenge-1';
const TOPIC = 'venue-pos-events';
const EVENT_ID = `event-${new Date().toISOString().split('T')[0]}`;

const pubsub = new PubSub({ projectId: PROJECT_ID });

const QUEUES = [
  { id: 'q-concession-a1', zone: 'zone-A', location: 'Gate A Concessions North', type: 'concession' },
  { id: 'q-concession-a2', zone: 'zone-A', location: 'Gate A Concessions South', type: 'concession' },
  { id: 'q-concession-b1', zone: 'zone-B', location: 'Level 1 Food Court', type: 'concession' },
  { id: 'q-concession-c1', zone: 'zone-C', location: 'Premium Bar West', type: 'concession' },
  { id: 'q-restroom-a1', zone: 'zone-A', location: 'Gate A Restrooms', type: 'restroom' },
  { id: 'q-restroom-b1', zone: 'zone-B', location: 'Level 2 Restrooms', type: 'restroom' },
  { id: 'q-restroom-d1', zone: 'zone-D', location: 'Tunnel Restrooms', type: 'restroom' },
  { id: 'q-merch-main', zone: 'zone-B', location: 'Main Merch Store', type: 'merch' },
];

// Simulates queue state based on game phase. Restrooms spike much harder than
// food/merch during half-time — modelled separately to trigger evaluateZoneThresholds
// alerts and demonstrate the full alert→push notification pipeline.
function getQueueState(queueId: string, elapsedMin: number) {
  // Half-time window: ~43–60 min (first break) and 88–100 min (second break)
  const isHalftime = (elapsedMin >= 43 && elapsedMin <= 60) || (elapsedMin >= 88 && elapsedMin <= 100);
  const isGameTime = elapsedMin < 15 || (elapsedMin > 45 && elapsedMin < 88) || elapsedMin > 105;

  let baseLength = Math.floor(Math.random() * 5) + 2;
  let baseWait = Math.random() * 3 + 1;

  if (isHalftime) {
    baseLength = Math.floor(Math.random() * 25) + 15;
    baseWait = Math.random() * 15 + 8;
  } else if (!isGameTime) {
    baseLength = Math.floor(Math.random() * 8) + 3;
    baseWait = Math.random() * 5 + 2;
  }

  // Restrooms get much worse at half-time
  if (queueId.includes('restroom') && isHalftime) {
    baseLength = Math.floor(Math.random() * 40) + 20;
    baseWait = Math.random() * 20 + 12;
  }

  return {
    length: baseLength,
    wait_min: Math.round(baseWait * 10) / 10,
  };
}

async function publishQueueSnapshot(elapsedMin: number) {
  const promises = QUEUES.map(async (queue) => {
    const { length, wait_min } = getQueueState(queue.id, elapsedMin);

    await pubsub.topic(TOPIC).publishMessage({
      json: {
        queue_id: queue.id,
        timestamp: new Date().toISOString(),
        zone: queue.zone,
        queue_type: queue.type,
        length,
        wait_min,
        event_id: EVENT_ID,
      },
    });
  });

  await Promise.allSettled(promises);
}

async function run() {
  const startTime = Date.now();
  const durationMin = 180;

  console.info(`\n🍺 POS / Queue Simulator starting`);
  console.info(`   Project: ${PROJECT_ID} | Topic: ${TOPIC}\n`);

  const tick = async () => {
    const elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin > durationMin) {
      console.info('✅ POS simulation complete.');
      process.exit(0);
    }

    await publishQueueSnapshot(elapsedMin);

    const isHalftime = (elapsedMin >= 43 && elapsedMin <= 60) || (elapsedMin >= 88 && elapsedMin <= 100);
    if (Math.round(elapsedMin * 2) % 5 === 0) {
      console.info(`   [${Math.round(elapsedMin)}min] ${isHalftime ? '⚡ HALF-TIME RUSH' : 'Normal'} — ${QUEUES.length} queues updated`);
    }

    setTimeout(() => void tick(), 30000); // Every 30 seconds
  };

  await tick();
}

void run().catch(console.error);
