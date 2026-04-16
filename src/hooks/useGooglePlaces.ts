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

  // Wait for Google Maps to be loaded
  const waitForGoogleMaps = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100;
      const check = () => {
        if (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Place) {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(check, 100);
        } else {
          reject(new Error('Google Maps Places API (New) not loaded after ' + maxAttempts + ' attempts'));
        }
      };
      check();
    });
  }, []);

  // Search for car wash stations using the NEW Places API
  const searchCarWashes = useCallback(async (lat: number, lng: number, radius: number = 10000) => {
    setIsLoading(true);
    setError(null);

    try {
      await waitForGoogleMaps();
      
      // Use the new Places API
      const { Place } = google.maps.places;
      
      const allResults: GooglePlaceStation[] = [];
      const seenPlaceIds = new Set<string>();

      // Search using the new API with text search
      const searchKeywords = ['car wash', 'lavage auto', 'station de lavage', 'car wash lome'];
      
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
                  name: place.displayName || 'Unknown',
                  address: place.formattedAddress || 'Address not available',
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

      // Also try nearby search for car_wash type
      try {
        const nearbyRequest = {
          fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'photos', 'businessStatus', 'openingHours', 'id'],
          location: { lat, lng },
          includedPrimaryTypes: ['car_wash'],
          maxResultCount: 20,
        };

        const { places } = await Place.searchNearby(nearbyRequest);
        
        if (places) {
          for (const place of places) {
            const placeId = place.id;
            if (placeId && !seenPlaceIds.has(placeId) && place.location) {
              seenPlaceIds.add(placeId);
              allResults.push({
                id: placeId,
                placeId: placeId,
                name: place.displayName || 'Unknown',
                address: place.formattedAddress || 'Address not available',
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
      } catch (nearbyError) {
        console.warn('Nearby search failed:', nearbyError);
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
  }, [waitForGoogleMaps]);

  // Get place details using the new API
  const getPlaceDetails = useCallback(async (placeId: string) => {
    try {
      await waitForGoogleMaps();
      
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
