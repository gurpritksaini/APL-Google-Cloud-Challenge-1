'use client';

import { useEffect } from 'react';
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

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  loading,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="glass-card flex flex-col gap-3 p-5">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
        <Icon size={20} />
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24 rounded-lg" />
      ) : (
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
      )}
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function HomePage() {
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

  useEffect(() => {
    if (zoneId) {
      void subscribeToZone(zoneId);
    }
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
          value={session ? session.totalEntries.toLocaleString() : '—'}
          label="Attendees"
          color="bg-[#4285F4]/10 text-[#4285F4]"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          value={session ? `${Math.round(session.avgQueueMin)}m` : '—'}
          label="Avg Queue"
          color="bg-[#34A853]/10 text-[#34A853]"
          loading={loading}
        />
        <StatCard
          icon={AlertTriangle}
          value={activeAlerts.length.toString()}
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
          value={session ? `${Math.round(session.peakOccupancy)}%` : '—'}
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
                  alert.severity === 'critical'
                    ? 'border-red-500/25'
                    : 'border-yellow-500/25',
                )}
              >
                <AlertTriangle
                  size={16}
                  className={
                    alert.severity === 'critical' ? 'text-[#EA4335]' : 'text-[#FBBC04]'
                  }
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
          <p className="text-xs text-white/30">Notifications blocked. Enable in browser settings.</p>
        </div>
      )}
    </div>
  );
}
