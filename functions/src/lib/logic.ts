// Pure business logic with no Firebase dependencies — safe to unit-test in
// isolation and importable from both Cloud Functions and scripts.

import type { ZoneStatus } from './schemas.js';

// Thresholds must stay in sync with WARN_THRESHOLD / CRITICAL_THRESHOLD in
// evaluateZoneThresholds.ts — change them there and here together.
export function zoneStatus(occupancyPct: number): ZoneStatus {
  if (occupancyPct >= 85) return 'critical';
  if (occupancyPct >= 70) return 'warning';
  return 'normal';
}

export function alertMessage(
  zoneName: string,
  pct: number,
  type: 'occupancy_critical' | 'occupancy_warn',
): string {
  return type === 'occupancy_critical'
    ? `Zone ${zoneName} is at critical capacity (${pct.toFixed(1)}%). Avoid this area.`
    : `Zone ${zoneName} is getting busy (${pct.toFixed(1)}%). Consider alternatives.`;
}

export function fcmTitle(severity: 'warning' | 'critical', zoneName: string): string {
  return severity === 'critical'
    ? `⚠️ Busy Area Alert — ${zoneName}`
    : `ℹ️ Area Update — ${zoneName}`;
}

export function fcmAction(
  type: 'occupancy_critical' | 'occupancy_warn' | 'queue_critical',
): 'avoid' | 'navigate' {
  return type === 'occupancy_critical' || type === 'occupancy_warn' ? 'avoid' : 'navigate';
}
