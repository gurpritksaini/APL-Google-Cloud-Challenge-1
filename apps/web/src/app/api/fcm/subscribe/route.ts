// Server route that subscribes an FCM device token to a venue zone topic.
// This must live on the server because the browser FCM SDK cannot subscribe to
// topics — topic management requires the Firebase Admin SDK and a service
// account, which must never be shipped to the client.

import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const bodySchema = z.object({
  token: z.string().min(1),
  topic: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
});

// Lazily initialises the Admin SDK. In production the service account JSON is
// provided via FIREBASE_SERVICE_ACCOUNT_KEY; in Cloud Run / GCF the SDK falls
// back to Application Default Credentials automatically.
function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountKey = process.env['FIREBASE_SERVICE_ACCOUNT_KEY'];
  if (serviceAccountKey) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountKey) as admin.ServiceAccount),
    });
  }

  return admin.initializeApp();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { token, topic } = parsed.data;

    const app = getAdminApp();
    await admin.messaging(app).subscribeToTopic([token], topic);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('FCM subscribe error', err);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
