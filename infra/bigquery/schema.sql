-- ============================================================
-- BigQuery Dataset: venue_analytics
-- Project: apl--cloud-challenge-1
-- ============================================================

-- Create dataset
CREATE SCHEMA IF NOT EXISTS `apl--cloud-challenge-1.venue_analytics`
OPTIONS (
  location = 'US',
  description = 'Smart Venue Platform analytics dataset'
);

-- ── entry_events ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE `apl--cloud-challenge-1.venue_analytics.entry_events` (
  gate_id       STRING NOT NULL,
  timestamp     TIMESTAMP NOT NULL,
  attendee_hash STRING NOT NULL,  -- SHA-256 of ticket barcode, no PII
  zone          STRING NOT NULL,
  event_id      STRING NOT NULL,
  direction     STRING NOT NULL   -- 'IN' | 'OUT'
)
PARTITION BY DATE(timestamp)
CLUSTER BY zone, gate_id
OPTIONS (
  description = 'Gate scan events — one row per turnstile scan',
  partition_expiration_days = 365
);

-- ── queue_events ──────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE `apl--cloud-challenge-1.venue_analytics.queue_events` (
  queue_id      STRING NOT NULL,
  timestamp     TIMESTAMP NOT NULL,
  wait_min      FLOAT64 NOT NULL,
  length        INT64 NOT NULL,
  zone          STRING NOT NULL,
  queue_type    STRING NOT NULL,  -- 'concession' | 'restroom' | 'merch'
  event_id      STRING NOT NULL
)
PARTITION BY DATE(timestamp)
CLUSTER BY zone, queue_type
OPTIONS (
  description = 'Queue length and wait-time snapshots, every 30 seconds per queue'
);

-- ── sensor_events ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE `apl--cloud-challenge-1.venue_analytics.sensor_events` (
  zone_id       STRING NOT NULL,
  timestamp     TIMESTAMP NOT NULL,
  occupancy_pct FLOAT64 NOT NULL,  -- 0.0 – 100.0
  headcount     INT64 NOT NULL,
  sensor_id     STRING NOT NULL,
  event_id      STRING NOT NULL
)
PARTITION BY DATE(timestamp)
CLUSTER BY zone_id
OPTIONS (
  description = 'IoT occupancy sensor readings, every 30 seconds per zone'
);

-- ── alert_events ──────────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE `apl--cloud-challenge-1.venue_analytics.alert_events` (
  alert_id      STRING NOT NULL,
  zone          STRING NOT NULL,
  type          STRING NOT NULL,   -- 'occupancy_critical' | 'occupancy_warn' | 'queue_critical'
  severity      STRING NOT NULL,   -- 'warning' | 'critical'
  triggered_at  TIMESTAMP NOT NULL,
  resolved_at   TIMESTAMP,
  duration_min  FLOAT64,           -- NULL until resolved
  event_id      STRING NOT NULL,
  fcm_sent      BOOL NOT NULL DEFAULT FALSE
)
PARTITION BY DATE(triggered_at)
CLUSTER BY zone, type
OPTIONS (
  description = 'Zone threshold breach alerts with resolution tracking'
);

-- ── session_metrics ───────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE `apl--cloud-challenge-1.venue_analytics.session_metrics` (
  session_id        STRING NOT NULL,
  event_date        DATE NOT NULL,
  event_name        STRING,
  peak_occupancy    FLOAT64,
  avg_queue_min     FLOAT64,
  total_entries     INT64,
  total_alerts      INT64,
  critical_alerts   INT64,
  snapshot_time     TIMESTAMP NOT NULL
)
PARTITION BY event_date
OPTIONS (
  description = 'Per-session aggregate metrics, updated every 15 minutes'
);

-- ── Useful views ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW `apl--cloud-challenge-1.venue_analytics.current_zone_status` AS
SELECT
  zone_id,
  occupancy_pct,
  headcount,
  timestamp,
  CASE
    WHEN occupancy_pct >= 85 THEN 'critical'
    WHEN occupancy_pct >= 70 THEN 'warning'
    ELSE 'normal'
  END AS status
FROM (
  SELECT
    zone_id, occupancy_pct, headcount, timestamp,
    ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY timestamp DESC) AS rn
  FROM `apl--cloud-challenge-1.venue_analytics.sensor_events`
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
)
WHERE rn = 1;

CREATE OR REPLACE VIEW `apl--cloud-challenge-1.venue_analytics.queue_leaderboard` AS
SELECT
  queue_id,
  zone,
  queue_type,
  wait_min,
  length,
  timestamp
FROM (
  SELECT
    queue_id, zone, queue_type, wait_min, length, timestamp,
    ROW_NUMBER() OVER (PARTITION BY queue_id ORDER BY timestamp DESC) AS rn
  FROM `apl--cloud-challenge-1.venue_analytics.queue_events`
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
)
WHERE rn = 1
ORDER BY wait_min DESC;
