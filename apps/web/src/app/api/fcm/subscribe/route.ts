import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const bodySchema = z.object({
  token: z.string().min(1),
  topic: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
});

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
    const body = await request.json();
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
