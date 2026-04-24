'use client';

import { useEffect } from 'react';
import { useFCM } from '@/hooks/useFCM';
import { useToast } from '@/components/ui/Toast';

// Listens for incoming FCM messages and surfaces them as in-app toasts.
export function NotificationHandler() {
  const { lastMessage } = useFCM();
  const { showToast } = useToast();

  useEffect(() => {
    if (!lastMessage) return;

    const { notification, data } = lastMessage;
    const severity = (data?.['severity'] as string | undefined) ?? 'info';

    showToast({
      type: severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'info',
      title: notification?.title ?? 'Venue Alert',
      message: notification?.body ?? '',
    });
  }, [lastMessage, showToast]);

  return null;
}
