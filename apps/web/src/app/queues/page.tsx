'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, SortAsc, TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { orderBy } from 'firebase/firestore';
import { useCollection } from '@/hooks/useFirestore';

interface QueueDoc {
  id: string;
  zone: string;
  location: string;
  queueType: 'concession' | 'restroom' | 'merch';
  waitMinutes: number;
  length: number;
  updatedAt?: { seconds: number };
}

type SortMode = 'wait' | 'zone';

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
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
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (target - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return displayed;
}

function useTrend(value: number): 'up' | 'down' | null {
  const prevRef = useRef<number | null>(null);
  const [trend, setTrend]       = useState<'up' | 'down' | null>(null);
  const [showing, setShowing]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (prevRef.current === null) { prevRef.current = value; return; }
    if (value !== prevRef.current) {
      setTrend(value > prevRef.current ? 'up' : 'down');
      setShowing(true);
      prevRef.current = value;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowing(false), 3000);
    }
  }, [value]);

  return showing ? trend : null;
}

// Live "updated X s ago" label
function useAgeLabel(seconds?: number) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!seconds) return;
    const tick = () => {
      const age = Math.floor(Date.now() / 1000) - seconds;
      setLabel(age < 5 ? 'just now' : age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return label;
}

// ── Components ────────────────────────────────────────────────────────────────

function WaitBadge({ minutes }: { minutes: number }) {
  const animated = useCountUp(Math.round(minutes));
  const trend    = useTrend(Math.round(minutes));

  const cls =
    minutes < 5   ? 'status-normal'   :
    minutes <= 15 ? 'status-warning'  : 'status-critical';

  return (
    <div className="flex items-center gap-1.5">
      {trend === 'down' && <TrendingDown size={12} className="text-emerald-400 shrink-0" />}
      {trend === 'up'   && <TrendingUp   size={12} className="text-red-400 shrink-0" />}
      <span className={clsx(cls, 'rounded-full px-3 py-1 text-xs font-bold tabular-nums')}>
        {minutes < 5 ? '< 5 min' : `${animated} min`}
      </span>
    </div>
  );
}

function typeLabel(t: QueueDoc['queueType']) {
  return { concession: 'Food & Drink', restroom: 'Restroom', merch: 'Merchandise' }[t];
}

function QueueRow({ queue }: { queue: QueueDoc }) {
  const ageLabel    = useAgeLabel(queue.updatedAt?.seconds);
  const animLength  = useCountUp(queue.length);

  return (
    <div className="glass-card flex items-center gap-4 p-4 transition-all duration-300">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-2xl">
        {queue.queueType === 'concession' ? '🍺' : queue.queueType === 'restroom' ? '🚻' : '👕'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{queue.location}</p>
        <p className="text-xs text-white/40 tabular-nums">
          {typeLabel(queue.queueType)} · <span className="tabular-nums">{animLength}</span> in queue
          {ageLabel && <> · {ageLabel}</>}
        </p>
      </div>
      <WaitBadge minutes={queue.waitMinutes} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="glass-card flex items-center gap-4 p-4">
      <div className="skeleton h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-48 rounded" />
      </div>
      <div className="skeleton h-7 w-16 rounded-full" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QueuesPage() {
  const [sortMode, setSortMode] = useState<SortMode>('wait');
  const [filter, setFilter]     = useState<string>('all');

  const { data: queues, loading } = useCollection<QueueDoc>(
    'queues',
    orderBy('waitMinutes', 'asc'),
  );

  const filtered = queues.filter((q) => filter === 'all' || q.queueType === filter);
  const sorted =
    sortMode === 'wait'
      ? [...filtered].sort((a, b) => a.waitMinutes - b.waitMinutes)
      : [...filtered].sort((a, b) => a.zone.localeCompare(b.zone));

  const avgWait =
    queues.length > 0
      ? Math.round(queues.reduce((s, q) => s + q.waitMinutes, 0) / queues.length)
      : null;

  const animAvg = useCountUp(avgWait ?? 0);

  const FILTER_TABS = [
    { value: 'all',        label: 'All'          },
    { value: 'concession', label: '🍺 Food'       },
    { value: 'restroom',   label: '🚻 Restrooms'  },
    { value: 'merch',      label: '👕 Merch'      },
  ];

  return (
    <div className="min-h-screen px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-white">Queue Times</h1>
        <p className="mt-1 text-sm text-white/40 tabular-nums">
          {avgWait !== null
            ? `Avg wait across venue: ${animAvg} min`
            : 'Live wait times'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={clsx(
              'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all',
              filter === tab.value
                ? 'bg-[#4285F4] text-white'
                : 'bg-white/[0.06] text-white/50 hover:text-white/80',
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setSortMode(sortMode === 'wait' ? 'zone' : 'wait')}
          className="ml-auto shrink-0 flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
        >
          <SortAsc size={12} />
          {sortMode === 'wait' ? 'By wait' : 'By zone'}
        </button>
      </div>

      {/* Queue list */}
      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          : sorted.map((q) => <QueueRow key={q.id} queue={q} />)}

        {!loading && sorted.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Clock size={32} className="mx-auto mb-3 text-white/20" />
            <p className="text-sm text-white/40">No queues available for this filter</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-white/20">
        Updates in real-time via Firestore · Powered by Google Cloud
      </p>
    </div>
  );
}
