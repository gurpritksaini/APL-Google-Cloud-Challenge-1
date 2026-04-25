// Zod schemas for validating Pub/Sub message payloads before any Firestore or
// BigQuery writes. If a schema parse fails the Cloud Function acks the message
// without retrying — malformed messages are logged and discarded rather than
// causing an infinite retry loop.

import { z } from 'zod';

// ── Pub/Sub event payload schemas ────────────────────────────

export const entryEventSchema = z.object({
  gate_id: z.string().min(1),
  timestamp: z.string().datetime(),
  attendee_hash: z.string().length(64), // SHA-256 hex
  zone: z.string().min(1),
  event_id: z.string().min(1),
  direction: z.enum(['IN', 'OUT']),
});

export const posEventSchema = z.object({
  queue_id: z.string().min(1),
  timestamp: z.string().datetime(),
  zone: z.string().min(1),
  queue_type: z.enum(['concession', 'restroom', 'merch']),
  length: z.number().int().min(0),
  wait_min: z.number().min(0),
  event_id: z.string().min(1),
});

export const sensorEventSchema = z.object({
  zone_id: z.string().min(1),
  timestamp: z.string().datetime(),
  occupancy_pct: z.number().min(0).max(100),
  headcount: z.number().int().min(0),
  sensor_id: z.string().min(1),
  event_id: z.string().min(1),
});

// ── Firestore document shapes ─────────────────────────────────

export type ZoneStatus = 'normal' | 'warning' | 'critical';

export interface ZoneDoc {
  name: string;
  capacity: number;
  current: number;
  occupancyPct: number;
  status: ZoneStatus;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface QueueDoc {
  zone: string;
  location: string;
  queueType: 'concession' | 'restroom' | 'merch';
  waitMinutes: number;
  length: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface AlertDoc {
  zone: string;
  type: 'occupancy_critical' | 'occupancy_warn' | 'queue_critical';
  severity: 'warning' | 'critical';
  message: string;
  triggeredAt: FirebaseFirestore.Timestamp;
  resolved: boolean;
  resolvedAt?: FirebaseFirestore.Timestamp;
  eventId: string;
}

export type EntryEvent = z.infer<typeof entryEventSchema>;
export type PosEvent = z.infer<typeof posEventSchema>;
export type SensorEvent = z.infer<typeof sensorEventSchema>;
