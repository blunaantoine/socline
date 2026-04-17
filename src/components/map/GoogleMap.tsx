'use client';

import { useCallback, useState, useEffect } from 'react';
import { GoogleMap as ReactGoogleMap, useJsApiLoader, Marker, InfoWindow, Circle, DirectionsRenderer } from '@react-google-maps/api';
import { MapPin, Navigation, Clock, Star, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const containerStyle = {
  width: '100%',
  height: '100%',
};

// Default center: Lomé, Togo
const defaultCenter = {
  lat: 6.1725,
  lng: 1.2314,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

interface MapMarker {
  id: string;
  type: 'USER' | 'WASHER' | 'STATION' | 'ORDER';
  position: { lat: number; lng: number };
  label?: string;
  data?: any;
}

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (e: google.maps.MapMouseEvent) => void;
  showUserLocation?: boolean;
  directions?: google.maps.DirectionsResult | null;
  className?: string;
  height?: string;
}

export function GoogleMap({
  center = defaultCenter,
  zoom = 14,
  markers = [],
  onMarkerClick,
  onMapClick,
  showUserLocation = false,
  directions = null,
  className = '',
  height = '400px',
}: GoogleMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: ['places', 'geometry'],
  });

  // Get user location
  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setUserLocation(defaultCenter);
        }
      );
    }
  }, [showUserLocation]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMapRef(null);
  }, []);

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
  };

  const getMarkerIcon = (type: MapMarker['type']) => {
    const colors = {
      USER: '#10b981', // emerald
      WASHER: '#3b82f6', // blue
      STATION: '#8b5cf6', // purple
      ORDER: '#f59e0b', // amber
    };

    const color = colors[type];

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: type === 'USER' ? 12 : 10,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    };
  };

  if (loadError) {
    return (
      <div className={`bg-slate-100 rounded-xl flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center p-4">
          <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-500">Erreur de chargement de la carte</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`bg-slate-100 rounded-xl flex items-center justify-center animate-pulse ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-500 text-sm">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  const mapCenter = userLocation || center;

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ height }}>
      <ReactGoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={onMapClick}
      >
        {/* User Location Circle */}
        {userLocation && showUserLocation && (
          <>
            <Circle
              center={userLocation}
              radius={100}
              options={{
                fillColor: '#10b981',
                fillOpacity: 0.15,
                strokeColor: '#10b981',
                strokeOpacity: 0.3,
                strokeWeight: 1,
              }}
            />
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
            />
          </>
        )}

        {/* Custom Markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={getMarkerIcon(marker.type)}
            onClick={() => handleMarkerClick(marker)}
          />
        ))}

        {/* Directions */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: '#10b981',
                strokeWeight: 4,
              },
            }}
          />
        )}

        {/* Info Window */}
        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2 min-w-[150px]">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  selectedMarker.type === 'WASHER' ? 'bg-blue-500' :
                  selectedMarker.type === 'STATION' ? 'bg-purple-500' :
                  selectedMarker.type === 'ORDER' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                <span className="font-medium text-sm">{selectedMarker.label}</span>
              </div>
              {selectedMarker.type === 'WASHER' && selectedMarker.data && (
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span>{selectedMarker.data.rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{selectedMarker.data.completedJobs || 0} lavages</span>
                  </div>
                  <Button size="sm" className="w-full mt-2 h-7 text-xs">
                    <Phone className="w-3 h-3 mr-1" />
                    Contacter
                  </Button>
                </div>
              )}
              {selectedMarker.type === 'STATION' && selectedMarker.data && (
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span>{selectedMarker.data.rating || 'N/A'} ({selectedMarker.data.totalRatings || 0} avis)</span>
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    Station
                  </Badge>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </ReactGoogleMap>
    </div>
  );
}

// Hook for directions
export function useDirections() {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(
    async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
      setLoading(true);
      setError(null);

      try {
        const directionsService = new google.maps.DirectionsService();
        const result = await directionsService.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        });
        setDirections(result);
      } catch (err) {
        setError('Impossible de calculer l\'itinéraire');
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearDirections = useCallback(() => {
    setDirections(null);
    setError(null);
  }, []);

  return { directions, loading, error, calculateRoute, clearDirections };
}

// Map Legend Component
export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <span className="text-slate-600">Votre position</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-slate-600">Laveurs</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-purple-500" />
        <span className="text-slate-600">Stations</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded-full bg-amber-500" />
        <span className="text-slate-600">Commande</span>
      </div>
    </div>
  );
}
