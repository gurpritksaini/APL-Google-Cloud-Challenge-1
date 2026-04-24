import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/ui/BottomNav';
import { ToastProvider } from '@/components/ui/Toast';
import { NotificationHandler } from '@/components/NotificationHandler';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Smart Venue Experience',
  description:
    'Real-time queue times, venue maps, and crowd alerts — no app install required.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Smart Venue',
  },
  openGraph: {
    title: 'Smart Venue Experience',
    description: 'Real-time venue intelligence powered by Google Cloud.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#05091a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-[#05091a] text-white">
        <ToastProvider>
          <NotificationHandler />
          <main className="flex-1 pb-20">{children}</main>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
