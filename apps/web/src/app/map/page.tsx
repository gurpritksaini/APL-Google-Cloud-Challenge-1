'use client';

import { useEffect, useRef, useState } from 'react';
import { useCollection } from '@/hooks/useFirestore';
import { clsx } from 'clsx';

declare global {
  interface Window {
    google: typeof google;
  }
}

interface ZoneDoc {
  id: string;
  name: string;
  capacity: number;
  current: number;
  occupancyPct: number;
  status: 'normal' | 'warning' | 'critical';
  lat?: number;
  lng?: number;
}

const VENUE_CENTER = { lat: -33.8688, lng: 151.2093 }; // Replace with real venue coords
const MAPS_API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? '';

const STATUS_COLORS = {
  normal: '#34A853',
  warning: '#FBBC04',
  critical: '#EA4335',
};

function ZoneLegend({ zones }: { zones: ZoneDoc[] }) {
  if (zones.length === 0) return null;
  return (
    <div className="absolute bottom-4 left-4 right-4 glass-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
        Zone Density
      </p>
      <div className="grid grid-cols-2 gap-2">
        {zones.slice(0, 4).map((zone) => (
          <div key={zone.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[zone.status], boxShadow: `0 0 8px ${STATUS_COLORS[zone.status]}` }}
            />
            <span className="text-xs text-white/70 truncate">{zone.name}</span>
            <span className="ml-auto text-xs font-semibold text-white/50">
              {Math.round(zone.occupancyPct)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-white/[0.08] pt-3">
        {(['normal', 'warning', 'critical'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[s] }}
            />
            <span className="text-[10px] capitalize text-white/40">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selected, setSelected] = useState<ZoneDoc | null>(null);

  const { data: zones } = useCollection<ZoneDoc>('zones');

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Script stays loaded — no cleanup needed
    };
  }, []);

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center: VENUE_CENTER,
      zoom: 17,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0d1630' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#05091a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2540' }] },
        { featureType: 'water', stylers: [{ color: '#0a1020' }] },
      ],
    });
  }, [mapLoaded]);

  // Update zone markers whenever zone data changes
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    zones.forEach((zone) => {
      if (!zone.lat || !zone.lng) return;

      const position = { lat: zone.lat, lng: zone.lng };
      const color = STATUS_COLORS[zone.status];
      const existing = markersRef.current.get(zone.id);

      if (existing) {
        existing.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 20 + (zone.occupancyPct / 100) * 10,
          fillColor: color,
          fillOpacity: 0.7,
          strokeColor: color,
          strokeWeight: 2,
        });
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map: googleMapRef.current!,
          title: zone.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 20 + (zone.occupancyPct / 100) * 10,
            fillColor: color,
            fillOpacity: 0.7,
            strokeColor: color,
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => setSelected(zone));
        markersRef.current.set(zone.id, marker);
      }
    });
  }, [zones, mapLoaded]);

  return (
    <div className="relative h-screen">
      {/* Header overlay */}
      <div className="absolute left-0 right-0 top-0 z-10 safe-top bg-gradient-to-b from-[#05091a] to-transparent pb-8 px-4 pt-4">
        <h1 className="text-2xl font-black text-white">Venue Map</h1>
        <p className="text-xs text-white/40">Live crowd density heatmap</p>
      </div>

      {/* Map container */}
      <div ref={mapRef} className="h-full w-full" />

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05091a]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-[#4285F4]" />
            <p className="text-sm text-white/40">Loading venue map…</p>
          </div>
        </div>
      )}

      {/* Zone info popup */}
      {selected && (
        <div className="absolute left-4 right-4 top-24 z-20">
          <div className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-white">{selected.name}</p>
                <p className="text-sm text-white/40">
                  {selected.current.toLocaleString()} / {selected.capacity.toLocaleString()} capacity
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-bold capitalize',
                  selected.status === 'normal' && 'status-normal',
                  selected.status === 'warning' && 'status-warning',
                  selected.status === 'critical' && 'status-critical',
                )}
              >
                {selected.status}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(selected.occupancyPct, 100)}%`,
                  backgroundColor: STATUS_COLORS[selected.status],
                }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-white/40">
              {Math.round(selected.occupancyPct)}% occupied
            </p>
            <button
              onClick={() => setSelected(null)}
              className="mt-3 w-full rounded-xl bg-white/[0.06] py-2 text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <ZoneLegend zones={zones} />
    </div>
  );
}
