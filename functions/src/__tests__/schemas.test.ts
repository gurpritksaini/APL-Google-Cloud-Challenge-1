import { entryEventSchema, posEventSchema, sensorEventSchema } from '../lib/schemas.js';

const validTimestamp = new Date().toISOString();
const validHash = 'a'.repeat(64);

describe('entryEventSchema', () => {
  const base = {
    gate_id: 'gate-01',
    timestamp: validTimestamp,
    attendee_hash: validHash,
    zone: 'zone-A',
    event_id: 'event-2024',
    direction: 'IN' as const,
  };

  it('accepts a valid IN event', () => {
    expect(entryEventSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a valid OUT event', () => {
    expect(entryEventSchema.safeParse({ ...base, direction: 'OUT' }).success).toBe(true);
  });

  it('rejects an invalid direction', () => {
    expect(entryEventSchema.safeParse({ ...base, direction: 'BOTH' }).success).toBe(false);
  });

  it('rejects a hash that is not 64 chars', () => {
    expect(entryEventSchema.safeParse({ ...base, attendee_hash: 'short' }).success).toBe(false);
  });

  it('rejects a missing zone', () => {
    const { zone: _, ...rest } = base;
    expect(entryEventSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(entryEventSchema.safeParse({ ...base, timestamp: 'not-a-date' }).success).toBe(false);
  });
});

describe('posEventSchema', () => {
  const base = {
    queue_id: 'q-concession-a1',
    timestamp: validTimestamp,
    zone: 'zone-A',
    queue_type: 'concession' as const,
    length: 12,
    wait_min: 5.5,
    event_id: 'event-2024',
  };

  it('accepts a valid queue event', () => {
    expect(posEventSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a negative queue length', () => {
    expect(posEventSchema.safeParse({ ...base, length: -1 }).success).toBe(false);
  });

  it('rejects an unknown queue type', () => {
    expect(posEventSchema.safeParse({ ...base, queue_type: 'gift_shop' }).success).toBe(false);
  });

  it('rejects a negative wait time', () => {
    expect(posEventSchema.safeParse({ ...base, wait_min: -1 }).success).toBe(false);
  });
});

describe('sensorEventSchema', () => {
  const base = {
    zone_id: 'zone-B',
    timestamp: validTimestamp,
    occupancy_pct: 72.5,
    headcount: 7250,
    sensor_id: 'sensor-B-01',
    event_id: 'event-2024',
  };

  it('accepts a valid sensor reading', () => {
    expect(sensorEventSchema.safeParse(base).success).toBe(true);
  });

  it('rejects occupancy above 100%', () => {
    expect(sensorEventSchema.safeParse({ ...base, occupancy_pct: 101 }).success).toBe(false);
  });

  it('rejects negative occupancy', () => {
    expect(sensorEventSchema.safeParse({ ...base, occupancy_pct: -1 }).success).toBe(false);
  });

  it('rejects a negative headcount', () => {
    expect(sensorEventSchema.safeParse({ ...base, headcount: -5 }).success).toBe(false);
  });
});
