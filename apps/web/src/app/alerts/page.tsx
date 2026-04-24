'use client';

import { useCollection } from '@/hooks/useFirestore';
import { useFCM } from '@/hooks/useFCM';
import { AlertTriangle, Bell, BellOff, CheckCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { orderBy, limit, where } from 'firebase/firestore';

interface AlertDoc {
  id: string;
  zone: string;
  type: 'occupancy_critical' | 'occupancy_warn' | 'queue_critical';
  severity: 'warning' | 'critical';
  message: string;
  triggeredAt?: { seconds: number };
  resolved: boolean;
  resolvedAt?: { seconds: number };
}

function formatTime(seconds: number) {
  const d = new Date(seconds * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AlertCard({ alert }: { alert: AlertDoc }) {
  const triggeredAt = alert.triggeredAt ? formatTime(alert.triggeredAt.seconds) : '—';
  const resolvedAt = alert.resolvedAt ? formatTime(alert.resolvedAt.seconds) : null;

  return (
    <div
      className={clsx(
        'glass-card p-4',
        !alert.resolved && alert.severity === 'critical' && 'border-red-500/25',
        !alert.resolved && alert.severity === 'warning' && 'border-yellow-500/25',
        alert.resolved && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            alert.resolved
              ? 'bg-emerald-500/10 text-emerald-400'
              : alert.severity === 'critical'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-yellow-500/10 text-yellow-400',
          )}
        >
          {alert.resolved ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">{alert.message}</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-white/30">
              <Clock size={10} />
              {triggeredAt}
            </span>
            {resolvedAt && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500/60">
                <CheckCircle size={10} />
                Resolved {resolvedAt}
              </span>
            )}
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                alert.severity === 'critical'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-yellow-500/10 text-yellow-400',
              )}
            >
              {alert.severity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { data: activeAlerts, loading: activeLoading } = useCollection<AlertDoc>(
    'alerts',
    where('resolved', '==', false),
    orderBy('triggeredAt', 'desc'),
    limit(20),
  );

  const { data: resolvedAlerts, loading: resolvedLoading } = useCollection<AlertDoc>(
    'alerts',
    where('resolved', '==', true),
    orderBy('resolvedAt', 'desc'),
    limit(10),
  );

  const { permission, requestPermission } = useFCM();

  const loading = activeLoading || resolvedLoading;

  return (
    <div className="min-h-screen px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Alerts</h1>
          <p className="mt-1 text-sm text-white/40">
            {activeAlerts.length > 0
              ? `${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}`
              : 'All clear · No active alerts'}
          </p>
        </div>

        {/* Notification toggle */}
        {permission === 'default' ? (
          <button
            onClick={() => void requestPermission()}
            className="flex items-center gap-2 rounded-xl bg-[#4285F4]/10 border border-[#4285F4]/25 px-3 py-2 text-xs font-semibold text-[#4285F4] transition-all hover:bg-[#4285F4]/20"
          >
            <Bell size={14} />
            Enable
          </button>
        ) : permission === 'granted' ? (
          <span className="flex items-center gap-1.5 text-xs text-[#34A853]">
            <Bell size={12} />
            On
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-white/30">
            <BellOff size={12} />
            Off
          </span>
        )}
      </div>

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Active
          </h2>
          <div className="flex flex-col gap-3">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-20 rounded-2xl" />
                ))
              : activeAlerts.map((a) => <AlertCard key={a.id} alert={a} />)}
          </div>
        </section>
      )}

      {/* All clear state */}
      {!loading && activeAlerts.length === 0 && (
        <div className="glass-card mb-6 p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <p className="font-semibold text-white">All clear</p>
          <p className="mt-1 text-sm text-white/40">No crowd issues detected right now</p>
        </div>
      )}

      {/* Recent resolved */}
      {resolvedAlerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            Recently Resolved
          </h2>
          <div className="flex flex-col gap-3">
            {resolvedAlerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
