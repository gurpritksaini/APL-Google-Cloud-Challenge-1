# Smart Venue Experience Platform — Task Board

> **Goal:** Build and demo a production-ready GCP-powered venue experience platform that wins the APL Google Cloud Challenge.
> **Stack:** Next.js 15 PWA · Firebase Firestore · Cloud Pub/Sub · Cloud Functions · BigQuery · FCM · Google Maps Platform · Looker Studio

---

## Task Status Legend
| Symbol | Meaning |
|--------|---------|
| `[ ]`  | To Do |
| `[~]`  | In Progress |
| `[x]`  | Done |
| `[!]`  | Blocked |

---

## Phase 1 — Foundation & GCP Setup `Week 1`

### 1.1 GCP Infrastructure

- [ ] **T001** `P0` · **Create GCP Project**
  - Create project `smart-venue-platform` in Google Cloud Console
  - Enable billing account
  - Link project to APL challenge billing
  - _Est: 30 min_

- [ ] **T002** `P0` · **Enable Required GCP APIs**
  - Enable: Pub/Sub, Cloud Functions, Firestore, BigQuery, FCM, Maps JavaScript API, Secret Manager, Cloud Build, Artifact Registry
  - Command: `gcloud services enable pubsub.googleapis.com cloudfunctions.googleapis.com firestore.googleapis.com bigquery.googleapis.com firebase.googleapis.com maps-backend.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com`
  - _Est: 20 min_

- [ ] **T003** `P0` · **IAM & Service Accounts**
  - Create `venue-functions-sa` service account (Cloud Functions runtime)
  - Create `venue-pubsub-sa` service account (Pub/Sub publisher)
  - Create `venue-bq-sa` service account (BigQuery writer)
  - Assign minimum required roles to each SA
  - _Est: 45 min_

- [ ] **T004** `P0` · **Firebase Project Initialization**
  - Init Firebase project linked to GCP project
  - Enable Firestore in Native mode (region: `us-central1`)
  - Enable Firebase Authentication (Anonymous + optional email)
  - Enable Firebase Cloud Messaging
  - Download `serviceAccountKey.json` → store in Secret Manager
  - _Est: 1 hr_

- [ ] **T005** `P0` · **Firestore Data Schema Design**
  - Define collections: `zones`, `queues`, `alerts`, `events`, `sessions`
  - Schema for `/zones/{zoneId}` → `{ name, capacity, current, status, updatedAt }`
  - Schema for `/queues/{queueId}` → `{ zone, location, waitMinutes, length, updatedAt }`
  - Schema for `/alerts/{alertId}` → `{ zone, type, severity, message, triggeredAt, resolved }`
  - Schema for `/sessions/{sessionId}` → `{ eventId, startTime, endTime, venue }`
  - Write Firestore security rules
  - _Est: 2 hr_
  - _Depends: T004_

- [ ] **T006** `P0` · **Cloud Pub/Sub Topics & Subscriptions**
  - Create topic: `venue-entry-events`
  - Create topic: `venue-pos-events`
  - Create topic: `venue-sensor-events`
  - Create topic: `venue-staff-events`
  - Create push subscriptions → Cloud Functions endpoints
  - _Est: 1 hr_
  - _Depends: T002_

- [ ] **T007** `P0` · **BigQuery Dataset & Tables**
  - Create dataset: `venue_analytics`
  - Table: `entry_events` (gate_id, timestamp, attendee_hash, zone)
  - Table: `queue_events` (queue_id, timestamp, wait_min, length, zone)
  - Table: `sensor_events` (zone_id, timestamp, occupancy_pct, headcount)
  - Table: `alert_events` (alert_id, zone, type, triggered_at, resolved_at, duration_min)
  - Table: `session_metrics` (session_id, event_date, peak_occupancy, avg_queue_min)
  - Enable table partitioning by `timestamp` on all tables
  - _Est: 1.5 hr_
  - _Depends: T002_

- [ ] **T008** `P0` · **Secret Manager Setup**
  - Store Firebase service account key
  - Store Maps Platform API key
  - Store FCM server key
  - Store BigQuery credentials
  - Grant Secret Accessor role to function service accounts
  - _Est: 45 min_
  - _Depends: T003_

---

### 1.2 Repository & Toolchain

- [ ] **T009** `P0` · **Monorepo Project Structure**
  - Scaffold: `apps/web/` (Next.js PWA), `functions/` (Cloud Functions), `infra/` (Terraform), `scripts/` (data simulators)
  - Initialize root `package.json` with workspaces
  - Setup `turbo.json` for Turborepo build orchestration
  - _Est: 1 hr_

- [ ] **T010** `P0` · **TypeScript & Code Quality Setup**
  - Configure `tsconfig.json` (strict mode, path aliases)
  - Setup ESLint with `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-import`
  - Setup Prettier with consistent formatting rules
  - Setup Husky pre-commit hooks (lint + type-check)
  - _Est: 1 hr_
  - _Depends: T009_

- [ ] **T011** `P1` · **CI/CD Pipeline (GitHub Actions)**
  - Workflow: `ci.yml` → lint, type-check, unit tests on PR
  - Workflow: `deploy-functions.yml` → deploy Cloud Functions on merge to main
  - Workflow: `deploy-web.yml` → deploy Next.js to Firebase Hosting on merge to main
  - Setup GCP Workload Identity Federation for keyless auth
  - _Est: 2 hr_
  - _Depends: T009_

- [ ] **T012** `P1` · **Environment Configuration**
  - Create `.env.local.example` with all required variables
  - Create `env.ts` with Zod validation for runtime env
  - Document all environment variables in README
  - _Est: 45 min_

---

## Phase 2 — Cloud Functions Backend `Week 2`

### 2.1 Event Processing Functions

- [ ] **T013** `P0` · **Function: `process-entry-event`**
  - Trigger: Pub/Sub topic `venue-entry-events`
  - Logic: Parse gate scan payload → update `/zones/{zoneId}.current` in Firestore → write to BigQuery `entry_events`
  - Input schema validation with Zod
  - Unit tests with Jest (mock Firestore + BQ clients)
  - _Est: 3 hr_
  - _Depends: T005, T006, T007_

- [ ] **T014** `P0` · **Function: `process-pos-event`**
  - Trigger: Pub/Sub topic `venue-pos-events`
  - Logic: Parse POS transaction → calculate queue length at that stand → update `/queues/{queueId}` → write to BigQuery
  - _Est: 2.5 hr_
  - _Depends: T005, T006_

- [ ] **T015** `P0` · **Function: `process-sensor-event`**
  - Trigger: Pub/Sub topic `venue-sensor-events`
  - Logic: Parse occupancy payload → calculate zone density % → update Firestore zone status (`normal/busy/critical`)
  - _Est: 2.5 hr_
  - _Depends: T005, T006_

- [ ] **T016** `P0` · **Function: `evaluate-zone-thresholds`**
  - Trigger: Scheduled (every 60 seconds via Cloud Scheduler)
  - Logic: Read all zone documents → compare occupancy to thresholds (warn: 70%, critical: 85%) → create `/alerts/{alertId}` if threshold breached → auto-resolve if back to normal
  - _Est: 3 hr_
  - _Depends: T013, T015_

- [ ] **T017** `P0` · **Function: `dispatch-fcm-notification`**
  - Trigger: Firestore `onDocumentCreated` for `/alerts/{alertId}`
  - Logic: Look up affected zone → compose targeted FCM message → send to topic `/topics/zone-{zoneId}` → log delivery status
  - FCM payload: title, body, zone, action (navigate/avoid)
  - _Est: 3 hr_
  - _Depends: T016_

- [ ] **T018** `P1` · **Function: `aggregate-session-metrics`**
  - Trigger: Scheduled (every 15 min)
  - Logic: Query BigQuery for rolling window metrics → update `/sessions/current` in Firestore → used by ops dashboard for live KPIs
  - _Est: 2 hr_
  - _Depends: T007, T013_

---

## Phase 3 — Attendee PWA `Week 2–3`

### 3.1 App Scaffold

- [ ] **T019** `P0` · **Next.js 15 PWA Bootstrap**
  - Init `apps/web` with `create-next-app` (App Router, TypeScript, Tailwind CSS)
  - Configure `next.config.ts` with PWA plugin (`@ducanh2912/next-pwa`)
  - Setup `manifest.json` (name, icons, theme_color, display: standalone)
  - Configure service worker with offline fallback
  - Verify Lighthouse PWA score ≥ 90 baseline
  - _Est: 3 hr_
  - _Depends: T009_

- [ ] **T020** `P0` · **Design System & Theme**
  - Configure Tailwind with custom colour tokens (GCP Blue, venue dark palette)
  - Create component primitives: `Button`, `Card`, `Badge`, `Skeleton`, `Toast`
  - Setup `shadcn/ui` for accessible base components
  - Add Google Fonts (Inter)
  - _Est: 2 hr_
  - _Depends: T019_

- [ ] **T021** `P0` · **Firebase Client SDK Setup**
  - Install `firebase` JS SDK v10
  - Create `lib/firebase.ts` (app, firestore, messaging instances)
  - Create `hooks/useFirestore.ts` (real-time snapshot listener hook)
  - Create `hooks/useFCM.ts` (notification permission + token management)
  - _Est: 2 hr_
  - _Depends: T019, T004_

---

### 3.2 PWA Screens

- [ ] **T022** `P0` · **Home / Dashboard Screen**
  - Show current event name, date, venue
  - 3 summary cards: Total attendees, Avg queue time, Alerts active
  - Live update via Firestore real-time listener
  - Loading skeletons while data fetches
  - _Est: 3 hr_
  - _Depends: T020, T021_

- [ ] **T023** `P0` · **Queue Times Screen**
  - List all concession stands and restroom zones with live wait times
  - Color-coded status badges: Green (< 5 min) / Amber (5–15 min) / Red (> 15 min)
  - Sort by nearest / shortest wait toggle
  - Auto-refresh every 30 seconds via Firestore listener
  - _Est: 3 hr_
  - _Depends: T021_

- [ ] **T024** `P0` · **Venue Map Screen**
  - Integrate Google Maps JavaScript API with Indoor Maps
  - Render venue floor plan overlay
  - Drop pins for: concession stands, restrooms, first aid, exits
  - Crowd density heatmap layer (colours from zone data)
  - Tap on pin → show queue time + "Navigate" button
  - _Est: 5 hr_
  - _Depends: T021, T023_

- [ ] **T025** `P1` · **Navigation / Wayfinding**
  - "Navigate" → compute walking route via Maps Directions API
  - Show step-by-step in-venue instructions
  - Route avoids high-density zones (pass zone density data to routing)
  - _Est: 4 hr_
  - _Depends: T024_

- [ ] **T026** `P0` · **Alerts / Notifications Screen**
  - List recent alerts affecting attendee's area
  - FCM foreground message handler → show in-app toast
  - Background FCM via service worker → native push notification
  - Notification opt-in prompt on first visit
  - Subscribe to zone FCM topics based on seat section
  - _Est: 3 hr_
  - _Depends: T021, T017_

- [ ] **T027** `P1` · **QR Code Entry Flow**
  - Landing page at `/?gate={gateId}&zone={zoneId}` (QR scan target)
  - Auto-detect zone from URL params → personalise content
  - "Add to Home Screen" prompt after first visit
  - No sign-up required (anonymous session)
  - _Est: 2 hr_
  - _Depends: T022_

- [ ] **T028** `P1` · **Offline Mode**
  - Cache venue map tiles, floor plan, and seat data via service worker
  - Offline banner when connection lost
  - Show cached queue times with "last updated" timestamp
  - _Est: 2 hr_
  - _Depends: T019_

---

## Phase 4 — Ops Dashboard `Week 3`

### 4.1 Looker Studio Dashboard

- [ ] **T029** `P0` · **BigQuery → Looker Studio Connection**
  - Create Looker Studio data source connected to `venue_analytics` BigQuery dataset
  - Configure scheduled refresh (every 5 minutes)
  - Set up custom metrics: avg_queue_min, peak_occupancy, alert_count
  - _Est: 1.5 hr_
  - _Depends: T007_

- [ ] **T030** `P0` · **Crowd Density Page**
  - Live zone occupancy % cards (1 per zone)
  - Bar chart: occupancy by zone (last 2 hours)
  - Heatmap table: zone × time period
  - Conditional formatting: red > 85%, amber > 70%
  - _Est: 2 hr_
  - _Depends: T029_

- [ ] **T031** `P0` · **Queue Performance Page**
  - Line chart: avg wait time per concession over event duration
  - Ranking table: busiest queues right now
  - Peak vs current comparison card
  - _Est: 2 hr_
  - _Depends: T029_

- [ ] **T032** `P1` · **Alert History Page**
  - Table: all alerts (zone, type, triggered_at, resolved_at, duration)
  - Summary KPIs: total alerts, avg resolution time, alerts by zone
  - Filter by severity / zone
  - _Est: 1.5 hr_
  - _Depends: T029_

- [ ] **T033** `P1` · **Post-Event Executive Report**
  - Single-page summary: attendance, peak crowd, avg queue, alert count, satisfaction estimate
  - Exportable as PDF from Looker Studio
  - _Est: 2 hr_
  - _Depends: T030, T031, T032_

---

## Phase 5 — Data Simulation & Integration `Week 4`

### 5.1 Event Simulators

- [ ] **T034** `P0` · **Gate Entry Simulator**
  - Script: `scripts/simulate-entries.ts`
  - Publishes realistic entry events to `venue-entry-events` Pub/Sub topic
  - Models crowd arrival curve (sparse → peak → taper)
  - Config: venue capacity, gate count, event duration
  - _Est: 2.5 hr_
  - _Depends: T006_

- [ ] **T035** `P0` · **POS / Queue Simulator**
  - Script: `scripts/simulate-pos.ts`
  - Publishes queue events at realistic intervals
  - Models concession rush at half-time / quarter-time
  - _Est: 2 hr_
  - _Depends: T006_

- [ ] **T036** `P0` · **IoT Sensor Simulator**
  - Script: `scripts/simulate-sensors.ts`
  - Publishes zone occupancy readings every 30 seconds
  - Simulates crowd build-up and redistribution after alerts
  - _Est: 2 hr_
  - _Depends: T006_

- [ ] **T037** `P1` · **Demo Seed Data**
  - Pre-populate Firestore with venue layout, zones, queues for demo
  - Seed 3 realistic alert scenarios for live demo
  - Create demo event session document
  - _Est: 1.5 hr_

---

## Phase 6 — Testing & QA `Week 4`

- [ ] **T038** `P0` · **Unit Tests — Cloud Functions**
  - Test each function with mock Firestore + BQ + Pub/Sub clients
  - Target: 80% coverage on business logic
  - Run: `npm test` in `functions/`
  - _Est: 3 hr_

- [ ] **T039** `P0` · **Integration Tests — End-to-End Flow**
  - Publish synthetic Pub/Sub event → verify Firestore updates within 2s
  - Verify FCM notification triggers when threshold breached
  - Verify BigQuery row inserted for each event type
  - _Est: 3 hr_
  - _Depends: T013–T018_

- [ ] **T040** `P0` · **PWA Lighthouse Audit**
  - Run Lighthouse on: Performance, Accessibility, Best Practices, SEO, PWA
  - Target scores: Performance ≥ 85, Accessibility ≥ 95, PWA ✓ all checks
  - Fix identified issues
  - _Est: 2 hr_
  - _Depends: T022–T028_

- [ ] **T041** `P1` · **Load Testing**
  - Tool: `k6` or `artillery`
  - Simulate 50,000 concurrent Firestore listeners
  - Simulate 10,000 FCM notifications dispatched
  - Verify no degradation in response times
  - _Est: 3 hr_

- [ ] **T042** `P1` · **Security Review**
  - Firestore rules audit (no unauthenticated writes)
  - API key restrictions (Maps, FCM)
  - Secret Manager audit (no keys in code)
  - CORS policy on Cloud Functions
  - _Est: 2 hr_

---

## Phase 7 — Deployment & Demo Prep `Week 4`

- [ ] **T043** `P0` · **Production Deployment**
  - Deploy all Cloud Functions to `us-central1`
  - Deploy Next.js PWA to Firebase Hosting
  - Set custom domain (if available)
  - Verify all Pub/Sub subscriptions active
  - Run smoke test against production endpoints
  - _Est: 3 hr_
  - _Depends: All prior tasks_

- [ ] **T044** `P0` · **Demo Script & Walkthrough**
  - Write 5-minute demo script covering:
    1. Attendee arrives → scans QR → opens PWA
    2. Sees live queue times + venue heatmap
    3. Crowd surges → FCM alert sent → attendee redirected
    4. Ops dashboard shows alert + staff deployed
    5. Post-event analytics report generated
  - Practice run: simulate scenario with seed data
  - _Est: 2 hr_

- [ ] **T045** `P0` · **Architecture Slide Deck**
  - Reference `diagrams/architecture.html` and `diagrams/workflow.html`
  - 5 slides: Problem → Solution → Architecture → Live Demo → Results
  - Include GCP service cost estimate
  - _Est: 2 hr_

- [ ] **T046** `P1` · **Performance Metrics Report**
  - Document: Firestore read latency, FCM delivery time, queue accuracy
  - Compare against success metrics in `planning.md`
  - _Est: 1 hr_

- [ ] **T047** `P0` · **Final Demo Dry-Run**
  - Full end-to-end run with audience
  - Test on mobile device (QR → PWA → notifications)
  - Test ops dashboard on laptop
  - Backup plan if internet drops (screenshots + video recording)
  - _Est: 2 hr_
  - _Depends: T044_

---

## Task Summary

| Phase | Tasks | Priority P0 | Priority P1 |
|-------|-------|-------------|-------------|
| 1 - Foundation | 12 | 9 | 3 |
| 2 - Cloud Functions | 6 | 5 | 1 |
| 3 - Attendee PWA | 10 | 7 | 3 |
| 4 - Ops Dashboard | 5 | 3 | 2 |
| 5 - Simulation | 4 | 3 | 1 |
| 6 - Testing | 5 | 3 | 2 |
| 7 - Demo Prep | 5 | 4 | 1 |
| **Total** | **47** | **34** | **13** |

---

## Acceptance Criteria for Launch

- [ ] PWA loads in < 3s on 4G connection
- [ ] Queue time accuracy within ± 2 minutes
- [ ] FCM alert delivery in < 5 seconds
- [ ] Firestore real-time update in < 500ms
- [ ] Looker Studio dashboard refreshes every 30 seconds
- [ ] Lighthouse PWA: all checks pass
- [ ] All P0 tasks complete
- [ ] Demo script rehearsed × 2
