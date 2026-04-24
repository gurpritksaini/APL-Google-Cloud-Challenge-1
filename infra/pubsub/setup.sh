#!/usr/bin/env bash
# ============================================================
# Pub/Sub Topics & Subscriptions Setup — T006
# Run this after T001 (GCP project created) and T002 (APIs enabled)
# Usage: bash infra/pubsub/setup.sh
# ============================================================
set -euo pipefail

PROJECT_ID="apl--cloud-challenge-1"
REGION="us-central1"
FUNCTIONS_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net"

echo "Setting up Pub/Sub topics for project: ${PROJECT_ID}"

gcloud config set project "${PROJECT_ID}"

# ── Create Topics ────────────────────────────────────────────
TOPICS=(
  "venue-entry-events"
  "venue-pos-events"
  "venue-sensor-events"
  "venue-staff-events"
)

for topic in "${TOPICS[@]}"; do
  echo "Creating topic: ${topic}"
  gcloud pubsub topics create "${topic}" \
    --message-retention-duration=7d \
    --project="${PROJECT_ID}" 2>/dev/null || echo "Topic ${topic} already exists"
done

# ── Create Push Subscriptions → Cloud Functions ──────────────
echo "Creating push subscriptions..."

gcloud pubsub subscriptions create "entry-events-sub" \
  --topic="venue-entry-events" \
  --push-endpoint="${FUNCTIONS_URL}/processEntryEvent" \
  --push-auth-service-account="venue-functions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --ack-deadline=60 \
  --min-retry-delay=10s \
  --max-retry-delay=600s \
  --project="${PROJECT_ID}" 2>/dev/null || echo "Subscription already exists"

gcloud pubsub subscriptions create "pos-events-sub" \
  --topic="venue-pos-events" \
  --push-endpoint="${FUNCTIONS_URL}/processPosEvent" \
  --push-auth-service-account="venue-functions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --ack-deadline=60 \
  --min-retry-delay=10s \
  --max-retry-delay=600s \
  --project="${PROJECT_ID}" 2>/dev/null || echo "Subscription already exists"

gcloud pubsub subscriptions create "sensor-events-sub" \
  --topic="venue-sensor-events" \
  --push-endpoint="${FUNCTIONS_URL}/processSensorEvent" \
  --push-auth-service-account="venue-functions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --ack-deadline=60 \
  --min-retry-delay=5s \
  --max-retry-delay=300s \
  --project="${PROJECT_ID}" 2>/dev/null || echo "Subscription already exists"

echo ""
echo "✅ Pub/Sub setup complete."
echo "Topics and subscriptions are ready."
