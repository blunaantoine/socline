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

export function useGooglePlaces() {
  const [stations, setStations] = useState<GooglePlaceStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Initialize Google Places service
  const initPlacesService = useCallback(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
      if (!mapRef.current) {
        // Create a hidden map div for the places service
        const mapDiv = document.createElement('div');
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
        mapRef.current = new google.maps.Map(mapDiv, { center: { lat: 6.1725, lng: 1.2314 }, zoom: 14 });
      }
      if (!placesServiceRef.current && mapRef.current) {
        placesServiceRef.current = new google.maps.places.PlacesService(mapRef.current);
      }
      return true;
    }
    return false;
  }, []);

  // Wait for Google Maps to be loaded
  const waitForGoogleMaps = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100;
      const check = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(check, 100);
        } else {
          reject(new Error('Google Maps not loaded after ' + maxAttempts + ' attempts'));
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
      
      if (!initPlacesService()) {
        throw new Error('Failed to initialize Places service');
      }

      if (!placesServiceRef.current) {
        throw new Error('Places service not initialized');
      }

      const location = new google.maps.LatLng(lat, lng);
      
      // Search for car wash stations using various keywords
      const searchKeywords = ['car wash', 'lavage auto', 'station de lavage', 'car wash lome togo'];
      const allResults: GooglePlaceStation[] = [];
      const seenPlaceIds = new Set<string>();

      for (const keyword of searchKeywords) {
        const request: google.maps.places.TextSearchRequest = {
          query: keyword,
          location: location,
          radius: radius,
        };

        const results = await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
          placesServiceRef.current!.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              resolve([]);
            }
          });
        });

        for (const place of results) {
          if (place.place_id && !seenPlaceIds.has(place.place_id) && place.geometry?.location) {
            seenPlaceIds.add(place.place_id);
            allResults.push({
              id: place.place_id,
              placeId: place.place_id,
              name: place.name || 'Unknown',
              address: place.formatted_address || place.vicinity || 'Address not available',
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              rating: place.rating || 0,
              totalRatings: place.user_ratings_total || 0,
              isOpen: place.opening_hours?.isOpen() ?? null,
              businessStatus: place.business_status || 'OPERATIONAL',
              types: place.types || [],
              photo: place.photos && place.photos[0] ? place.photos[0].getUrl({ maxWidth: 400 }) : null,
            });
          }
        }
      }

      // Sort by rating
      allResults.sort((a, b) => b.rating - a.rating);
      
      setStations(allResults.slice(0, 20));
      return allResults.slice(0, 20);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search car washes';
      setError(errorMessage);
      console.error('Error searching car washes:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [waitForGoogleMaps, initPlacesService]);

  // Get place details
  const getPlaceDetails = useCallback(async (placeId: string) => {
    try {
      await waitForGoogleMaps();
      
      if (!initPlacesService() || !placesServiceRef.current) {
        throw new Error('Places service not initialized');
      }

      return new Promise<google.maps.places.PlaceResult | null>((resolve) => {
        placesServiceRef.current!.getDetails(
          {
            placeId,
            fields: ['name', 'formatted_address', 'formatted_phone_number', 'opening_hours', 'photos', 'rating', 'user_ratings_total', 'reviews', 'website'],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve(place);
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (err) {
      console.error('Error getting place details:', err);
      return null;
    }
  }, [waitForGoogleMaps, initPlacesService]);

  return {
    stations,
    isLoading,
    error,
    searchCarWashes,
    getPlaceDetails,
  };
}
