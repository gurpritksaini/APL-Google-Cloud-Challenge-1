import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

// Only wrap with PWA plugin in production — PWA plugin conflicts with
// Node.js v22+ experimental localStorage in dev mode
async function getConfig() {
  if (isDev) return nextConfig;

  const { default: withPWAInit } = await import('@ducanh2912/next-pwa');
  const withPWA = withPWAInit({
    dest: 'public',
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    workboxOptions: {
      disableDevLogs: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
          },
        },
        {
          urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'google-maps',
            expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
          },
        },
        {
          urlPattern: /\/api\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: { maxEntries: 64, maxAgeSeconds: 60 },
          },
        },
      ],
    },
  });
  return withPWA(nextConfig);
}

export default getConfig();
