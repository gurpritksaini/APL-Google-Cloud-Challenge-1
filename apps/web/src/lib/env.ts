// Validates all required NEXT_PUBLIC_* environment variables at module load time.
// Any missing or malformed variable throws immediately — errors surface at startup
// instead of silently breaking at runtime inside a component.

import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_GCP_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FCM_VAPID_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  // Feature flags — Next.js env vars are always strings, so we coerce "true"/"false".
  NEXT_PUBLIC_ENABLE_OFFLINE_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  NEXT_PUBLIC_ENABLE_INDOOR_MAPS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
});

const parsed = clientSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration — check .env.local');
}

export const env = parsed.data;
export type Env = z.infer<typeof clientSchema>;
