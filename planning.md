# Smart Venue Experience Platform — Project Plan

## Objective
Improve the physical event experience at large-scale sporting venues by addressing crowd movement, waiting times, and real-time coordination using Google Cloud.

---

## Solution Overview
A Progressive Web App (PWA) for attendees and an ops dashboard for staff, both powered by a real-time GCP data pipeline. Attendees access via QR code at entry — no app install required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (Attendee) | PWA — Next.js + Google Maps Platform |
| Frontend (Staff) | Looker Studio dashboard |
| Real-time DB | Firebase Firestore |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Event Ingestion | Cloud Pub/Sub |
| Business Logic | Cloud Functions |
| Analytics | BigQuery |

---

## Key Features

### Attendee PWA
- Live queue times for concessions, restrooms, and entry gates
- Venue map with crowd density heatmap
- Turn-by-turn in-venue navigation to seat or facility
- Push notifications for short-wait alerts and venue announcements

### Staff Ops Dashboard
- Real-time crowd density per zone
- Automated bottleneck alerts when thresholds are exceeded
- One-click broadcast notifications to attendees in a zone
- Historical analytics for post-event review

---

## Data Flow

```
Entry Gates / POS / Sensors
        ↓
   Cloud Pub/Sub
        ↓
  Cloud Functions
        ↓
Firebase Firestore ──→ Attendee PWA (real-time)
        ↓
    BigQuery    ──→ Looker Studio (ops dashboard)
        ↓
      FCM       ──→ Push Notifications
```

---

## Milestones

### Week 1 — Foundation
- [ ] GCP project setup and IAM configuration
- [ ] Firestore data schema design (zones, queues, alerts)
- [ ] Cloud Pub/Sub topics and subscriptions
- [ ] Cloud Functions for ingesting and processing events

### Week 2 — Attendee PWA
- [ ] Next.js PWA scaffold with service worker
- [ ] Queue times screen (live Firestore reads)
- [ ] Venue map with Google Maps Platform indoor maps
- [ ] Crowd heatmap overlay

### Week 3 — Staff Dashboard & Notifications
- [ ] BigQuery export from Firestore
- [ ] Looker Studio dashboard (crowd density, queue trends)
- [ ] FCM integration for push notifications
- [ ] Automated alert rules (zone threshold triggers)

### Week 4 — Integration & Polish
- [ ] Connect real gate/POS/sensor data via Pub/Sub
- [ ] QR code entry flow for attendees
- [ ] Load and performance testing
- [ ] Deployment and documentation

---

## Scalability Design

- **Firestore** — handles 1M+ concurrent connections natively
- **Pub/Sub** — ingests millions of events/sec without tuning
- **Cloud Functions** — serverless, scales to zero and bursts instantly
- **PWA** — works on any device, no app store bottleneck

---

## Success Metrics

| Metric | Target |
|---|---|
| Queue time accuracy | Within 2 minutes of actual wait |
| Notification delivery latency | < 5 seconds |
| PWA load time | < 3 seconds on 4G |
| Concurrent attendee sessions | 50,000+ |
| Ops dashboard refresh rate | Every 30 seconds |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Poor venue Wi-Fi/connectivity | PWA offline mode with cached map data |
| Sensor data unavailable | Manual staff input as fallback |
| Cold start latency on Cloud Functions | Keep-warm pings for critical functions |
| Attendee adoption | QR code at gate entry, no sign-up required |
