'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Clock, AlertTriangle, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { useDocument, useCollection } from '@/hooks/useFirestore';
import { useFCM } from '@/hooks/useFCM';
import { where, limit, orderBy } from 'firebase/firestore';

interface SessionDoc {
  id: string;
  eventId: string;
  eventName?: string;
  totalEntries: number;
  avgQueueMin: number;
  totalAlerts: number;
  criticalAlerts: number;
  peakOccupancy: number;
  lastUpdated?: { seconds: number };
}

interface AlertDoc {
  id: string;
  zone: string;
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  resolved: boolean;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

// Smoothly counts from current displayed value to new target (ease-out cubic).
// Skips animation on first mount so the initial load feels instant.
function useCountUp(target: number, duration = 700) {
  const initialized = useRef(false);
  const fromRef     = useRef(target);
  const frameRef    = useRef(0);
  const [displayed, setDisplayed] = useState(target);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fromRef.current = target;
      setDisplayed(target);
      return;
    }
    const from  = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(frameRef.current);

    const tick = (now: number) => {
      const t      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (target - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return displayed;
}

// Returns the signed change and whether to show it (visible for 2.5 s after each update).
function useDelta(value: number) {
  const prevRef  = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [delta, setDelta]     = useState(0);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (prevRef.current === null) { prevRef.current = value; return; }
    const d = value - prevRef.current;
    prevRef.current = value;
    if (d === 0) return;
    setDelta(d);
    setShowing(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowing(false), 2500);
  }, [value]);

  return { delta, showing };
}

// Live "updated X seconds ago" label that ticks every second.
function useRelativeTime(seconds?: number) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!seconds) return;
    const tick = () => {
      const age = Math.floor(Date.now() / 1000) - seconds;
      if (age < 5)  setLabel('just now');
      else if (age < 60) setLabel(`${age}s ago`);
      else setLabel(`${Math.floor(age / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return label;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  numericValue,
  suffix = '',
  label,
  color,
  loading,
}: {
  icon: React.ElementType;
  numericValue: number | null;
  suffix?: string;
  label: string;
  color: string;
  loading: boolean;
}) {
  const safeValue = numericValue ?? 0;
  const animated  = useCountUp(safeValue);
  const { delta, showing } = useDelta(safeValue);

  // Brief ring-flash when value changes
  const flashRef   = useRef(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flashRef.current) { flashRef.current = true; return; }
    if (numericValue === null) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [numericValue]);

  return (
    <div
      className={clsx(
        'glass-card flex flex-col gap-3 p-5 transition-all duration-500',
        flash && 'ring-1 ring-white/25 shadow-[0_0_16px_rgba(255,255,255,0.06)]',
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon size={20} />
        </div>

        {/* Delta badge */}
        <span
          className={clsx(
            'text-[11px] font-bold rounded-full px-2 py-0.5 transition-all duration-300',
            showing && delta !== 0
              ? delta > 0
                ? 'opacity-100 bg-emerald-400/15 text-emerald-400'
                : 'opacity-100 bg-red-400/15 text-red-400'
              : 'opacity-0',
          )}
        >
          {delta > 0 ? '+' : ''}{delta.toLocaleString()}{suffix}
        </span>
      </div>

      {loading ? (
        <div className="skeleton h-8 w-24 rounded-lg" />
      ) : (
        <p className="text-2xl font-black tracking-tight text-white tabular-nums">
          {numericValue !== null ? `${animated.toLocaleString()}${suffix}` : '—'}
        </p>
      )}

      <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}

function HomePage() {
  const searchParams = useSearchParams();
  const gateId = searchParams.get('gate');
  const zoneId = searchParams.get('zone');

  const { data: session, loading } = useDocument<SessionDoc>('sessions', 'current');
  const { data: activeAlerts } = useCollection<AlertDoc>(
    'alerts',
    where('resolved', '==', false),
    orderBy('triggeredAt', 'desc'),
    limit(3),
  );

  const { requestPermission, permission, subscribeToZone } = useFCM();
  const updatedLabel = useRelativeTime(session?.lastUpdated?.seconds);

  useEffect(() => {
    if (zoneId) void subscribeToZone(zoneId);
  }, [zoneId, subscribeToZone]);

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="min-h-screen px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#34A853] shadow-[0_0_8px_#34A853] animate-pulse-slow" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#34A853]">
            Live
          </span>
          {updatedLabel && (
            <span className="ml-auto text-[10px] text-white/20 tabular-nums">
              Updated {updatedLabel}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          {session?.eventName ?? 'Smart Venue'}
        </h1>
        <p className="mt-1 text-sm text-white/40">
          {gateId ? `Entered via Gate ${gateId}` : 'Real-time venue intelligence'}
          {zoneId ? ` · Zone ${zoneId.toUpperCase()}` : ''}
        </p>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={Users}
          numericValue={session?.totalEntries ?? null}
          label="Attendees"
          color="bg-[#4285F4]/10 text-[#4285F4]"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          numericValue={session ? Math.round(session.avgQueueMin) : null}
          suffix="m"
          label="Avg Queue"
          color="bg-[#34A853]/10 text-[#34A853]"
          loading={loading}
        />
        <StatCard
          icon={AlertTriangle}
          numericValue={activeAlerts.length}
          label="Active Alerts"
          color={
            criticalCount > 0
              ? 'bg-[#EA4335]/10 text-[#EA4335]'
              : 'bg-[#FBBC04]/10 text-[#FBBC04]'
          }
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          numericValue={session ? Math.round(session.peakOccupancy) : null}
          suffix="%"
          label="Peak Occupancy"
          color="bg-purple-500/10 text-purple-400"
          loading={loading}
        />
      </div>

      {/* Active Alerts strip */}
      {activeAlerts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Active Alerts
          </h2>
          <div className="flex flex-col gap-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={clsx(
                  'glass-card flex items-start gap-3 p-4',
                  alert.severity === 'critical' ? 'border-red-500/25' : 'border-yellow-500/25',
                )}
              >
                <AlertTriangle
                  size={16}
                  className={alert.severity === 'critical' ? 'text-[#EA4335]' : 'text-[#FBBC04]'}
                />
                <p className="text-sm text-white/80 leading-snug">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification opt-in */}
      {permission === 'default' && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4285F4]/10 text-[#4285F4]">
              <Wifi size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Enable Alerts</p>
              <p className="text-xs text-white/40">
                Get notified about crowd surges and short queues
              </p>
            </div>
            <button
              onClick={() => void requestPermission()}
              className="rounded-xl bg-[#4285F4] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Allow
            </button>
          </div>
        </div>
      )}

      {permission === 'denied' && (
        <div className="glass-card flex items-center gap-3 p-4">
          <WifiOff size={16} className="text-white/30" />
          <p className="text-xs text-white/30">
            Notifications blocked. Enable in browser settings.
          </p>
        </div>
      )}
    </div>
  );
}
