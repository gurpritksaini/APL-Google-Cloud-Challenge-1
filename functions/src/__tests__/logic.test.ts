import { zoneStatus, alertMessage, fcmTitle, fcmAction } from '../lib/logic.js';

describe('zoneStatus', () => {
  it('returns normal below 70%', () => {
    expect(zoneStatus(0)).toBe('normal');
    expect(zoneStatus(50)).toBe('normal');
    expect(zoneStatus(69.9)).toBe('normal');
  });

  it('returns warning between 70% and 84.9%', () => {
    expect(zoneStatus(70)).toBe('warning');
    expect(zoneStatus(75)).toBe('warning');
    expect(zoneStatus(84.9)).toBe('warning');
  });

  it('returns critical at 85% and above', () => {
    expect(zoneStatus(85)).toBe('critical');
    expect(zoneStatus(90)).toBe('critical');
    expect(zoneStatus(100)).toBe('critical');
  });
});

describe('alertMessage', () => {
  it('builds a critical message with correct phrasing', () => {
    const msg = alertMessage('East Stand', 87.5, 'occupancy_critical');
    expect(msg).toContain('East Stand');
    expect(msg).toContain('87.5');
    expect(msg).toContain('Avoid');
  });

  it('builds a warning message with correct phrasing', () => {
    const msg = alertMessage('Main Entrance', 73.2, 'occupancy_warn');
    expect(msg).toContain('Main Entrance');
    expect(msg).toContain('73.2');
    expect(msg).toContain('Consider');
  });

  it('formats pct to one decimal place', () => {
    const msg = alertMessage('Zone A', 85, 'occupancy_critical');
    expect(msg).toContain('85.0');
  });
});

describe('fcmTitle', () => {
  it('uses warning icon and phrasing for warning severity', () => {
    const title = fcmTitle('warning', 'Level 1 Concourse');
    expect(title).toContain('Level 1 Concourse');
    expect(title).toContain('ℹ️');
  });

  it('uses alert icon and phrasing for critical severity', () => {
    const title = fcmTitle('critical', 'North End');
    expect(title).toContain('North End');
    expect(title).toContain('⚠️');
  });
});

describe('fcmAction', () => {
  it('returns avoid for occupancy_critical', () => {
    expect(fcmAction('occupancy_critical')).toBe('avoid');
  });

  it('returns avoid for occupancy_warn', () => {
    expect(fcmAction('occupancy_warn')).toBe('avoid');
  });

  it('returns navigate for queue_critical', () => {
    expect(fcmAction('queue_critical')).toBe('navigate');
  });
});
