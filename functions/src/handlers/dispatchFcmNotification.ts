import * as functions from 'firebase-functions/v2';
import { messaging, zonesCol } from '../lib/firebase.js';
import type { AlertDoc } from '../lib/schemas.js';
import { fcmTitle, fcmAction } from '../lib/logic.js';

// T017: dispatch-fcm-notification
// Trigger: Firestore onDocumentCreated /alerts/{alertId}
// Fires the moment evaluateZoneThresholds writes a new alert document.
// Sends platform-specific FCM messages (Android high priority, APNs sound,
// webpush requireInteraction for critical) to the zone-{id} topic so only
// attendees in the affected zone are notified.
export const dispatchFcmNotification = functions.firestore.onDocumentCreated(
  {
    document: 'alerts/{alertId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const alertData = event.data?.data() as AlertDoc | undefined;
    if (!alertData) return;

    const { zone, severity, message, type } = alertData;

    // Look up zone display name
    const zoneSnap = await zonesCol().doc(zone).get();
    const zoneName = zoneSnap.exists ? (zoneSnap.data()?.['name'] as string) : zone;

    const title = fcmTitle(severity, zoneName);
    const action = fcmAction(type);

    // Send to zone-specific FCM topic (attendees subscribed at entry scan)
    const fcmTopic = `zone-${zone}`;

    await messaging.send({
      topic: fcmTopic,
      notification: {
        title,
        body: message,
      },
      data: {
        zone,
        type,
        severity,
        action,
        alertId: event.params['alertId'] ?? '',
      },
      android: {
        priority: severity === 'critical' ? 'high' : 'normal',
        notification: {
          channelId: 'venue-alerts',
          priority: severity === 'critical' ? 'max' : 'default',
          vibrateTimingsMillis: severity === 'critical' ? [0, 250, 250, 250] : [0, 100],
        },
      },
      apns: {
        headers: {
          'apns-priority': severity === 'critical' ? '10' : '5',
        },
        payload: {
          aps: {
            ...(severity === 'critical' ? { sound: 'default' } : {}),
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          requireInteraction: severity === 'critical',
        },
        fcmOptions: {
          link: `/?zone=${zone}&alert=${event.params['alertId']}`,
        },
      },
    });

    functions.logger.info('FCM notification sent', {
      topic: fcmTopic,
      severity,
      type,
      zone,
    });
  },
);
