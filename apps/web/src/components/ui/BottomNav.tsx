// Fixed bottom navigation bar shared across all pages. Uses the current pathname
// to highlight the active tab. The nav items intentionally mirror the four main
// use cases: overview, queue times, venue map, and alerts.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Clock, MapPin, Bell } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/queues', icon: Clock, label: 'Queues' },
  { href: '/map', icon: MapPin, label: 'Map' },
  { href: '/alerts', icon: Bell, label: 'Alerts' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom border-t border-white/[0.08] bg-[#05091a]/95 backdrop-blur-xl">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all duration-200',
                active
                  ? 'text-[#4285F4]'
                  : 'text-white/40 hover:text-white/70',
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={clsx('transition-transform', active && 'scale-110')}
              />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              {active && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#4285F4]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
