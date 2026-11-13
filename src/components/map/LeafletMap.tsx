'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom colored icons
const createColoredIcon = (color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="40">
      <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};

// ---------------------------------------------------------------------
// Icônes « appli de livraison » (styles : .socline-* dans globals.css)
// ---------------------------------------------------------------------
// Voiture (icône Car de lucide) — tracé blanc dans la pastille du laveur.
const CAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
// Maison (icône House de lucide) — adresse du lavage.
const HOUSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

// Laveur : pastille ronde orange + voiture, halo qui pulse, flèche de direction
// (orientée selon le cap quand il est connu).
const createWasherIcon = (heading: number | null) =>
  L.divIcon({
    html:
      '<div class="socline-washer">' +
      '<span class="socline-washer-pulse"></span>' +
      (heading === null
        ? ''
        : `<span class="socline-washer-heading" style="transform:rotate(${Math.round(heading)}deg)"><span></span></span>`) +
      `<span class="socline-washer-badge">${CAR_SVG}</span>` +
      '</div>',
    className: 'socline-marker',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -24],
  });

// Adresse du lavage : épingle navy avec une maison.
const createHomeIcon = () =>
  L.divIcon({
    html: `<div class="socline-home"><span class="socline-home-pin">${HOUSE_SVG}</span></div>`,
    className: 'socline-marker',
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -42],
  });

// Cap (en degrés, 0 = nord) pour aller de `from` à `to`.
function bearing(from: [number, number], to: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Marqueur du laveur : il GLISSE d'une position à la suivante (1,5 s, sortie
// douce) comme sur les applis de livraison, au lieu de sauter ; la flèche se
// tourne vers sa direction. Sans animation si l'utilisateur a réduit les
// animations du téléphone.
function WasherMarker({ position, label, onClick }: { position: [number, number]; label?: string; onClick?: () => void }) {
  const markerRef = useRef<L.Marker | null>(null);
  // Position initiale figée : ensuite, c'est l'animation qui déplace le marqueur.
  const [initial] = useState(position);
  const [icon] = useState(() => createWasherIcon(null));
  const [lat, lng] = position;

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const current = marker.getLatLng();
    const from: [number, number] = [current.lat, current.lng];
    const to: [number, number] = [lat, lng];
    // Déplacement de plus de ~3 m : on oriente la flèche.
    if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) > 0.00003) {
      marker.setIcon(createWasherIcon(bearing(from, to)));
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      marker.setLatLng(to);
      return;
    }
    const start = performance.now();
    const duration = 1500;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      marker.setLatLng([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lat, lng]);

  return (
    <Marker
      ref={markerRef}
      position={initial}
      icon={icon}
      zIndexOffset={1000}
      eventHandlers={{ click: () => onClick?.() }}
    >
      {label && (
        <Popup>
          <div className="text-sm">
            <strong>{label}</strong>
          </div>
        </Popup>
      )}
    </Marker>
  );
}

// Set default icon
if (typeof window !== 'undefined') {
  L.Marker.prototype.options.icon = defaultIcon;
}

// Default center: Lomé, Togo
const defaultCenter: [number, number] = [6.1725, 1.2314];

// Helper for client-side only rendering (recommended React 18 pattern)
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface MapMarker {
  id: string;
  type: 'USER' | 'WASHER' | 'STATION' | 'ORDER' | 'CLIENT';
  position: [number, number];
  label?: string;
  data?: any;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showUserLocation?: boolean;
  className?: string;
  height?: string;
  selectedPosition?: [number, number] | null;
  // When true and 2+ markers exist, auto-fit the viewport so every marker
  // stays visible (used by the live order tracking map).
  fitToMarkers?: boolean;
  // Marges (px) laissées libres lors du cadrage automatique, pour que les
  // marqueurs ne passent pas sous des encadrés posés sur la carte.
  fitPadding?: { top?: number; bottom?: number; side?: number };
}

// Component to handle map events
function MapEvents({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to update map center
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Component to auto-fit the viewport around all markers (live tracking).
function MapFit({ markers, enabled, padding }: { markers: MapMarker[]; enabled: boolean; padding?: { top?: number; bottom?: number; side?: number } }) {
  const map = useMap();
  const top = padding?.top ?? 40;
  const bottom = padding?.bottom ?? 40;
  const side = padding?.side ?? 40;
  useEffect(() => {
    if (!enabled || markers.length < 2) return;
    const bounds = L.latLngBounds(markers.map((m) => L.latLng(m.position[0], m.position[1])));
    map.fitBounds(bounds, { paddingTopLeft: [side, top], paddingBottomRight: [side, bottom], maxZoom: 16 });
  }, [markers, enabled, map, top, bottom, side]);
  return null;
}

export function LeafletMap({
  center = defaultCenter,
  zoom = 14,
  markers = [],
  onMarkerClick,
  onMapClick,
  showUserLocation = false,
  className = '',
  height = '400px',
  selectedPosition,
  fitToMarkers = false,
  fitPadding,
}: LeafletMapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // Use useSyncExternalStore for client-side detection (React 18+ recommended pattern)
  const isClient = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  // Get user location
  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          setUserLocation(defaultCenter);
        }
      );
    }
  }, [showUserLocation]);

  const mapCenter = userLocation || center;
  const homeIcon = useMemo(() => createHomeIcon(), []);

  const getMarkerIcon = (type: MapMarker['type']) => {
    const colors: Record<string, string> = {
      USER: '#10b981',    // emerald
      WASHER: '#3b82f6',  // blue
      STATION: '#8b5cf6', // purple
      ORDER: '#f59e0b',   // amber
      CLIENT: '#FF9800',  // orange
    };
    return createColoredIcon(colors[type] || '#FF9800');
  };

  // Combine markers with selected position
  const allMarkers = useMemo(() => {
    const result = [...markers];
    if (selectedPosition) {
      result.push({
        id: 'selected',
        type: 'CLIENT' as const,
        position: selectedPosition,
      });
    }
    return result;
  }, [markers, selectedPosition]);

  // Don't render on server side
  if (!isClient) {
    return (
      <div 
        className={`rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center ${className}`} 
        style={{ height }}
      >
        <div className="text-gray-400">Chargement de la carte...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents onMapClick={onMapClick} />
        <MapUpdater center={mapCenter} />
        <MapFit markers={allMarkers} enabled={fitToMarkers} padding={fitPadding} />

        {/* User Location Circle */}
        {userLocation && showUserLocation && (
          <>
            <Circle
              center={userLocation}
              radius={100}
              pathOptions={{
                fillColor: '#10b981',
                fillOpacity: 0.15,
                color: '#10b981',
                opacity: 0.3,
                weight: 1,
              }}
            />
            <Marker
              position={userLocation}
              icon={getMarkerIcon('USER')}
            >
              <Popup>Vous êtes ici</Popup>
            </Marker>
          </>
        )}

        {/* Custom Markers */}
        {allMarkers.map((marker) => marker.type === 'WASHER' ? (
          <WasherMarker
            key={marker.id}
            position={marker.position}
            label={marker.label}
            onClick={() => onMarkerClick?.(marker)}
          />
        ) : (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={marker.type === 'CLIENT' || marker.type === 'ORDER' ? homeIcon : getMarkerIcon(marker.type)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker),
            }}
          >
            {marker.label && (
              <Popup>
                <div className="text-sm">
                  <strong>{marker.label}</strong>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default LeafletMap;
