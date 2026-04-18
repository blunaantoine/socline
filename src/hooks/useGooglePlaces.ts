'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface GooglePlaceStation {
  id: string;
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  totalRatings: number;
  isOpen: boolean | null;
  businessStatus: string;
  types: string[];
  photo: string | null;
}

// Fallback stations for Lomé, Togo when Google API is not available
const FALLBACK_STATIONS: GooglePlaceStation[] = [
  {
    id: 'fallback-1',
    placeId: 'fallback-1',
    name: 'Lavage Auto Plus',
    address: 'Avenue de la Marina, Lomé, Togo',
    latitude: 6.1375,
    longitude: 1.2127,
    rating: 4.5,
    totalRatings: 28,
    isOpen: true,
    businessStatus: 'OPERATIONAL',
    types: ['car_wash'],
    photo: null,
  },
  {
    id: 'fallback-2',
    placeId: 'fallback-2',
    name: 'Station Lavage Centre-Ville',
    address: 'Boulevard du 13 Janvier, Lomé, Togo',
    latitude: 6.1500,
    longitude: 1.2300,
    rating: 4.2,
    totalRatings: 15,
    isOpen: true,
    businessStatus: 'OPERATIONAL',
    types: ['car_wash'],
    photo: null,
  },
  {
    id: 'fallback-3',
    placeId: 'fallback-3',
    name: 'Auto Spa Togo',
    address: 'Rue du Commerce, Lomé, Togo',
    latitude: 6.1650,
    longitude: 1.2450,
    rating: 4.8,
    totalRatings: 42,
    isOpen: true,
    businessStatus: 'OPERATIONAL',
    types: ['car_wash'],
    photo: null,
  },
  {
    id: 'fallback-4',
    placeId: 'fallback-4',
    name: 'Lavage Express Adidogomé',
    address: 'Adidogomé, Lomé, Togo',
    latitude: 6.1850,
    longitude: 1.2050,
    rating: 4.0,
    totalRatings: 12,
    isOpen: false,
    businessStatus: 'OPERATIONAL',
    types: ['car_wash'],
    photo: null,
  },
  {
    id: 'fallback-5',
    placeId: 'fallback-5',
    name: 'Clean Car Station',
    address: 'Avenue Pya, Lomé, Togo',
    latitude: 6.1750,
    longitude: 1.2200,
    rating: 4.3,
    totalRatings: 23,
    isOpen: true,
    businessStatus: 'OPERATIONAL',
    types: ['car_wash'],
    photo: null,
  },
];

export function useGooglePlaces() {
  // Initialize with fallback stations immediately
  const [stations, setStations] = useState<GooglePlaceStation[]>(FALLBACK_STATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for Google Maps to be loaded
  const waitForGoogleMaps = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // Reduced wait time
      const check = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(check, 100);
        } else {
          reject(new Error('Google Maps API non disponible'));
        }
      };
      check();
    });
  }, []);

  // Search for car wash stations
  const searchCarWashes = useCallback(async (lat: number, lng: number, radius: number = 10000) => {
    setIsLoading(true);
    setError(null);

    try {
      await waitForGoogleMaps();
      
      // Check if new Places API is available
      if (!window.google?.maps?.places?.Place) {
        console.warn('New Places API not available, using fallback stations');
        setStations(FALLBACK_STATIONS);
        return FALLBACK_STATIONS;
      }
      
      // Use the new Places API
      const { Place } = google.maps.places;
      
      const allResults: GooglePlaceStation[] = [];
      const seenPlaceIds = new Set<string>();

      // Search using the new API with text search
      const searchKeywords = ['car wash lome togo', 'lavage auto lome', 'station lavage togo'];
      
      for (const keyword of searchKeywords) {
        try {
          const request = {
            textQuery: keyword,
            fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'photos', 'businessStatus', 'openingHours', 'id'],
            locationBias: { lat, lng },
            maxResultCount: 20,
          };

          const { places } = await Place.searchByText(request);
          
          if (places) {
            for (const place of places) {
              const placeId = place.id;
              if (placeId && !seenPlaceIds.has(placeId) && place.location) {
                seenPlaceIds.add(placeId);
                allResults.push({
                  id: placeId,
                  placeId: placeId,
                  name: place.displayName || 'Station de lavage',
                  address: place.formattedAddress || 'Adresse non disponible',
                  latitude: place.location.lat(),
                  longitude: place.location.lng(),
                  rating: place.rating || 0,
                  totalRatings: place.userRatingCount || 0,
                  isOpen: place.openingHours?.isOpen() ?? null,
                  businessStatus: place.businessStatus || 'OPERATIONAL',
                  types: [],
                  photo: place.photos && place.photos[0] ? place.photos[0].getURI() : null,
                });
              }
            }
          }
        } catch (searchError) {
          console.warn(`Search for "${keyword}" failed:`, searchError);
        }
      }

      // If we got results, use them; otherwise use fallback
      if (allResults.length > 0) {
        allResults.sort((a, b) => b.rating - a.rating);
        setStations(allResults.slice(0, 20));
        return allResults.slice(0, 20);
      } else {
        console.warn('No results from Google API, using fallback stations');
        setStations(FALLBACK_STATIONS);
        return FALLBACK_STATIONS;
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la recherche';
      setError(errorMessage);
      console.error('Error searching car washes, using fallback:', err);
      // Use fallback stations on error
      setStations(FALLBACK_STATIONS);
      return FALLBACK_STATIONS;
    } finally {
      setIsLoading(false);
    }
  }, [waitForGoogleMaps]);

  // Get place details
  const getPlaceDetails = useCallback(async (placeId: string) => {
    try {
      await waitForGoogleMaps();
      
      if (!window.google?.maps?.places?.Place) {
        return null;
      }
      
      const { Place } = google.maps.places;
      
      const place = new Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'nationalPhoneNumber', 'internationalPhoneNumber', 'openingHours', 'photos', 'rating', 'userRatingCount', 'reviews', 'websiteURI'],
      });
      
      return place;
    } catch (err) {
      console.error('Error getting place details:', err);
      return null;
    }
  }, [waitForGoogleMaps]);

  return {
    stations,
    isLoading,
    error,
    searchCarWashes,
    getPlaceDetails,
  };
}
