'use client';

import { useEffect, useState, useCallback } from 'react';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseMessaging, ensureAnonymousAuth } from '@/lib/firebase';

const VAPID_KEY = process.env['NEXT_PUBLIC_FCM_VAPID_KEY'];

interface UseFCMResult {
  token: string | null;
  permission: NotificationPermission;
  lastMessage: MessagePayload | null;
  requestPermission: () => Promise<boolean>;
  subscribeToZone: (zoneId: string) => Promise<void>;
}

export function useFCM(): UseFCMResult {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [lastMessage, setLastMessage] = useState<MessagePayload | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Listen for foreground FCM messages
  useEffect(() => {
    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      setLastMessage(payload);
    });

    return () => unsubscribe();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    await ensureAnonymousAuth();
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== 'granted') return false;

    try {
      const messaging = getFirebaseMessaging();
      if (!messaging || !VAPID_KEY) return false;

      const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      setToken(fcmToken);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Subscribe device to a zone-specific FCM topic via our API
  const subscribeToZone = useCallback(
    async (zoneId: string): Promise<void> => {
      if (!token) return;
      try {
        await fetch('/api/fcm/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, topic: `zone-${zoneId}` }),
        });
      } catch {
        // Non-critical — fail silently
      }
    },
    [token],
  );

  return { token, permission, lastMessage, requestPermission, subscribeToZone };
}
