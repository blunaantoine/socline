'use client';

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
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
        {allMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={getMarkerIcon(marker.type)}
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
