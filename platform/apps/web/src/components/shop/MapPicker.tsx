'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILES ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TEHRAN = { lat: 35.7219, lng: 51.3347 };

/** A map with a fixed pin in the middle: the customer drags the map under the pin. */
export function MapPicker({ value, onChange, center, label }: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number } | null;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then((L) => {
      if (disposed || !el.current || map.current) return;
      const start = value ?? center ?? TEHRAN;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : 13);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      m.on('moveend', () => {
        const c = m.getCenter();
        cb.current({ lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 });
      });
      map.current = m;
      if (!value) cb.current(start);
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && map.current) {
      const c = map.current.getCenter();
      if (Math.abs(c.lat - value.lat) > 1e-5 || Math.abs(c.lng - value.lng) > 1e-5) map.current.setView([value.lat, value.lng], 16);
    }
  }, [value]);

  return (
    <div className="map" role="application" aria-label={label}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      <span className="pin" aria-hidden>
        <svg width="34" height="46" viewBox="0 0 34 46"><path d="M17 1C8.2 1 1 8.2 1 17c0 11.5 16 28 16 28s16-16.5 16-28C33 8.2 25.8 1 17 1Z" fill="#662482" stroke="#fff" strokeWidth="2" /><path d="M17 9c1.1 3.2 2.8 4.9 6 6-3.2 1.1-4.9 2.8-6 6-1.1-3.2-2.8-4.9-6-6 3.2-1.1 4.9-2.8 6-6Z" fill="#fff" /></svg>
      </span>
    </div>
  );
}
