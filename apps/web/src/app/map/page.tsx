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

const VENUE_CENTER = {
  lat: parseFloat(process.env['NEXT_PUBLIC_VENUE_LAT'] ?? '-37.8199'),
  lng: parseFloat(process.env['NEXT_PUBLIC_VENUE_LNG'] ?? '144.9834'),
};
const MAPS_API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? '';

const STATUS_COLORS = {
  normal:   '#34A853',
  warning:  '#FBBC04',
  critical: '#EA4335',
};

// Fallback coords (MCG layout) when Firestore zone docs lack lat/lng
const ZONE_FALLBACK: Record<string, { lat: number; lng: number }> = {
  'zone-A': { lat: -37.8208, lng: 144.9834 },
  'zone-B': { lat: -37.8199, lng: 144.9834 },
  'zone-C': { lat: -37.8199, lng: 144.9824 },
  'zone-D': { lat: -37.8203, lng: 144.9840 },
  'zone-E': { lat: -37.8199, lng: 144.9845 },
  'zone-F': { lat: -37.8199, lng: 144.9823 },
  'zone-G': { lat: -37.8191, lng: 144.9834 },
  'zone-H': { lat: -37.8207, lng: 144.9834 },
};

// ── Particle system ───────────────────────────────────────────────────────────

const MAX_PARTICLES_PER_ZONE = 28;
const WANDER_RADIUS = 0.00035; // ~40 m in degrees at MCG latitude

interface Particle {
  zoneLat: number;
  zoneLng: number;
  lat: number;
  lng: number;
  dlat: number;
  dlng: number;
  color: string;
  alpha: number;
  targetAlpha: number;
}

function makeParticle(zoneLat: number, zoneLng: number, color: string): Particle {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * WANDER_RADIUS;
  const speed = 0.000002 + Math.random() * 0.000003;
  const vAngle = Math.random() * Math.PI * 2;
  return {
    zoneLat, zoneLng,
    lat: zoneLat + Math.sin(angle) * r,
    lng: zoneLng + Math.cos(angle) * r,
    dlat: Math.sin(vAngle) * speed,
    dlng: Math.cos(vAngle) * speed,
    color,
    alpha: 0,
    targetAlpha: 0.75 + Math.random() * 0.25,
  };
}

// ── Canvas overlay ────────────────────────────────────────────────────────────
// The canvas lives directly in the map container div (not inside a map pane)
// so it is always sized to the visible viewport.
// fromLatLngToContainerPixel() returns coordinates relative to the container,
// which is exactly what we need — no manual offset arithmetic required.

function createParticleOverlay(
  map: google.maps.Map,
  mapDiv: HTMLDivElement,
  particlesRef: React.MutableRefObject<Particle[]>,
) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';
  mapDiv.appendChild(canvas);

  class ParticleOverlay extends window.google.maps.OverlayView {
    private animId = 0;

    onAdd() {
      this.startAnimation();
    }

    draw() {
      // Keep canvas sized to the map container on every map redraw
      canvas.width  = mapDiv.offsetWidth;
      canvas.height = mapDiv.offsetHeight;
    }

    private startAnimation() {
      const tick = () => {
        this.animId = requestAnimationFrame(tick);
        const proj = this.getProjection();
        if (!proj) return;

        // Sync canvas size (handles resize without waiting for draw())
        if (canvas.width !== mapDiv.offsetWidth || canvas.height !== mapDiv.offsetHeight) {
          canvas.width  = mapDiv.offsetWidth;
          canvas.height = mapDiv.offsetHeight;
        }

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of particlesRef.current) {
          // Physics
          p.lat += p.dlat + (Math.random() - 0.5) * 0.0000015;
          p.lng += p.dlng + (Math.random() - 0.5) * 0.0000015;

          const dLat = p.lat - p.zoneLat;
          const dLng = p.lng - p.zoneLng;
          const dist  = Math.sqrt(dLat * dLat + dLng * dLng);
          if (dist > WANDER_RADIUS) {
            p.dlat = -p.dlat * 0.8;
            p.dlng = -p.dlng * 0.8;
            p.lat  = p.zoneLat + (dLat / dist) * WANDER_RADIUS * 0.95;
            p.lng  = p.zoneLng + (dLng / dist) * WANDER_RADIUS * 0.95;
          }

          p.alpha += (p.targetAlpha - p.alpha) * 0.05;

          // fromLatLngToContainerPixel → viewport-relative coords, no offset needed
          const pt = proj.fromLatLngToContainerPixel(
            new window.google.maps.LatLng(p.lat, p.lng),
          );
          if (!pt) continue;
          if (pt.x < -10 || pt.x > canvas.width + 10 || pt.y < -10 || pt.y > canvas.height + 10) continue;

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      tick();
    }

    onRemove() {
      cancelAnimationFrame(this.animId);
      canvas.remove();
    }
  }

  const overlay = new ParticleOverlay();
  overlay.setMap(map);
  return overlay;
}

// ── Legend ────────────────────────────────────────────────────────────────────

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
              style={{
                backgroundColor: STATUS_COLORS[zone.status],
                boxShadow: `0 0 8px ${STATUS_COLORS[zone.status]}`,
              }}
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
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
            <span className="text-[10px] capitalize text-white/40">{s}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/60" />
          <span className="text-[10px] text-white/40">Live attendees</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selected, setSelected] = useState<ZoneDoc | null>(null);

  const { data: zones } = useCollection<ZoneDoc>('zones');

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) { setMapLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map + particle overlay
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: VENUE_CENTER,
      zoom: 16,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry',            stylers: [{ color: '#0d1630' }] },
        { elementType: 'labels.text.fill',    stylers: [{ color: '#a0aec0' }] },
        { elementType: 'labels.text.stroke',  stylers: [{ color: '#05091a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2540' }] },
        { featureType: 'water', stylers: [{ color: '#0a1020' }] },
      ],
    });

    googleMapRef.current = map;
    overlayRef.current = createParticleOverlay(map, mapRef.current, particlesRef);

    return () => {
      overlayRef.current?.setMap(null);
    };
  }, [mapLoaded]);

  // Sync zone markers + particle counts when Firestore data updates
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded || zones.length === 0) return;

    const map = googleMapRef.current;
    const bounds = new window.google.maps.LatLngBounds();

    // Index current particles by zone key for fast reconciliation
    const particlesByZone = new Map<string, Particle[]>();
    for (const p of particlesRef.current) {
      const key = `${p.zoneLat.toFixed(6)}_${p.zoneLng.toFixed(6)}`;
      const arr = particlesByZone.get(key) ?? [];
      arr.push(p);
      particlesByZone.set(key, arr);
    }

    zones.forEach((zone) => {
      const fallback = ZONE_FALLBACK[zone.id];
      const lat = zone.lat ?? fallback?.lat;
      const lng = zone.lng ?? fallback?.lng;
      if (!lat || !lng) return;

      const position = { lat, lng };
      const color = STATUS_COLORS[zone.status];
      const scale = 18 + (zone.occupancyPct / 100) * 12;

      // Zone circle marker (halo behind particles)
      const existing = markersRef.current.get(zone.id);
      if (existing) {
        existing.setPosition(position);
        existing.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: color,
          fillOpacity: 0.25,
          strokeColor: color,
          strokeWeight: 2,
        });
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: zone.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: color,
            fillOpacity: 0.25,
            strokeColor: color,
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => setSelected(zone));
        markersRef.current.set(zone.id, marker);
      }

      bounds.extend(position);

      // Reconcile particle count for this zone
      const target = Math.min(
        Math.round((zone.occupancyPct / 100) * MAX_PARTICLES_PER_ZONE),
        MAX_PARTICLES_PER_ZONE,
      );
      const key = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
      const existing_p = particlesByZone.get(key) ?? [];

      if (existing_p.length < target) {
        for (let i = existing_p.length; i < target; i++) {
          particlesRef.current.push(makeParticle(lat, lng, color));
        }
      } else {
        for (let i = target; i < existing_p.length; i++) {
          existing_p[i]!.targetAlpha = 0;
        }
      }
    });

    // Prune fully-faded particles
    particlesRef.current = particlesRef.current.filter(
      (p) => !(p.targetAlpha === 0 && p.alpha < 0.02),
    );

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 90, right: 24, bottom: 180, left: 24 });
    }
  }, [zones, mapLoaded]);

  return (
    <div className="relative h-screen">
      {/* Header overlay */}
      <div className="absolute left-0 right-0 top-0 z-10 safe-top bg-gradient-to-b from-[#05091a] to-transparent pb-8 px-4 pt-4">
        <h1 className="text-2xl font-black text-white">Venue Map</h1>
        <p className="text-xs text-white/40">Live crowd movement</p>
      </div>

      {/* Map container — canvas is injected here by the overlay */}
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
                  selected.status === 'normal'   && 'status-normal',
                  selected.status === 'warning'  && 'status-warning',
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

      <ZoneLegend zones={zones} />
    </div>
  );
}
