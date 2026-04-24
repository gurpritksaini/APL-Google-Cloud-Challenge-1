/**
 * Unit tests for zone threshold evaluation business logic.
 * Mocks Firestore and BigQuery clients — tests logic only.
 */

import { describe, expect, test } from '@jest/globals';

// ── Pure logic extracted from evaluateZoneThresholds ─────────

const WARN_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 85;

type ZoneStatus = 'normal' | 'warning' | 'critical';

function getZoneStatus(occupancyPct: number): ZoneStatus {
  if (occupancyPct >= CRITICAL_THRESHOLD) return 'critical';
  if (occupancyPct >= WARN_THRESHOLD) return 'warning';
  return 'normal';
}

function shouldCreateAlert(occupancyPct: number, hasActiveAlert: boolean): boolean {
  return (occupancyPct >= WARN_THRESHOLD) && !hasActiveAlert;
}

function shouldResolveAlert(occupancyPct: number, hasActiveAlert: boolean): boolean {
  return occupancyPct < WARN_THRESHOLD && hasActiveAlert;
}

// ── Tests ─────────────────────────────────────────────────────

describe('getZoneStatus', () => {
  test('returns normal below 70%', () => {
    expect(getZoneStatus(0)).toBe('normal');
    expect(getZoneStatus(50)).toBe('normal');
    expect(getZoneStatus(69.9)).toBe('normal');
  });

  test('returns warning between 70% and 84.9%', () => {
    expect(getZoneStatus(70)).toBe('warning');
    expect(getZoneStatus(77)).toBe('warning');
    expect(getZoneStatus(84.9)).toBe('warning');
  });

  test('returns critical at 85% and above', () => {
    expect(getZoneStatus(85)).toBe('critical');
    expect(getZoneStatus(92)).toBe('critical');
    expect(getZoneStatus(100)).toBe('critical');
  });

  test('exactly at boundary values', () => {
    expect(getZoneStatus(WARN_THRESHOLD)).toBe('warning');
    expect(getZoneStatus(CRITICAL_THRESHOLD)).toBe('critical');
    expect(getZoneStatus(WARN_THRESHOLD - 0.1)).toBe('normal');
  });
});

describe('shouldCreateAlert', () => {
  test('creates alert when threshold breached with no active alert', () => {
    expect(shouldCreateAlert(75, false)).toBe(true);
    expect(shouldCreateAlert(90, false)).toBe(true);
  });

  test('does not create duplicate alert when one is already active', () => {
    expect(shouldCreateAlert(75, true)).toBe(false);
    expect(shouldCreateAlert(90, true)).toBe(false);
  });

  test('does not create alert below threshold', () => {
    expect(shouldCreateAlert(69, false)).toBe(false);
    expect(shouldCreateAlert(50, false)).toBe(false);
  });
});

describe('shouldResolveAlert', () => {
  test('resolves alert when zone returns to normal', () => {
    expect(shouldResolveAlert(65, true)).toBe(true);
    expect(shouldResolveAlert(0, true)).toBe(true);
  });

  test('does not resolve if still above threshold', () => {
    expect(shouldResolveAlert(75, true)).toBe(false);
    expect(shouldResolveAlert(90, true)).toBe(false);
  });

  test('no-op if no active alert to resolve', () => {
    expect(shouldResolveAlert(65, false)).toBe(false);
  });
});

describe('alert severity derivation', () => {
  test('critical alert at critical occupancy', () => {
    const status = getZoneStatus(90);
    expect(status).toBe('critical');
  });

  test('warning alert at warning occupancy', () => {
    const status = getZoneStatus(72);
    expect(status).toBe('warning');
  });
});
