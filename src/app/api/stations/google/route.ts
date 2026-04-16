import { NextRequest, NextResponse } from 'next/server';

// Google Places API types
interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
  business_status?: string;
}

interface GooglePlacesResponse {
  results: GooglePlaceResult[];
  status: string;
  next_page_token?: string;
}

// GET /api/stations/google - Search car wash stations using Google Places API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude') || '6.1725');
    const longitude = parseFloat(searchParams.get('longitude') || '1.2314');
    const radius = parseInt(searchParams.get('radius') || '5000'); // meters
    const keyword = searchParams.get('keyword') || 'car wash';

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Search for car wash stations using Google Places Nearby Search API
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('radius', radius.toString());
    url.searchParams.set('type', 'car_wash');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'fr');

    const response = await fetch(url.toString());
    const data: GooglePlacesResponse = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status);
      return NextResponse.json(
        { success: false, error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    // Transform Google Places results to our station format
    const stations = data.results.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating || 0,
      totalRatings: place.user_ratings_total || 0,
      isOpen: place.opening_hours?.open_now ?? null,
      businessStatus: place.business_status,
      types: place.types,
      photo: place.photos?.[0]?.photo_reference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
        : null,
    }));

    // Also search with broader keywords for more results
    const additionalKeywords = ['lavage auto', 'lavage voiture', 'station de lavage'];
    const additionalResults: typeof stations = [];

    for (const kw of additionalKeywords) {
      const additionalUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      additionalUrl.searchParams.set('location', `${latitude},${longitude}`);
      additionalUrl.searchParams.set('radius', radius.toString());
      additionalUrl.searchParams.set('keyword', kw);
      additionalUrl.searchParams.set('key', apiKey);
      additionalUrl.searchParams.set('language', 'fr');

      const additionalResponse = await fetch(additionalUrl.toString());
      const additionalData: GooglePlacesResponse = await additionalResponse.json();

      if (additionalData.status === 'OK') {
        for (const place of additionalData.results) {
          // Avoid duplicates
          if (!stations.find(s => s.id === place.place_id) && 
              !additionalResults.find(s => s.id === place.place_id)) {
            additionalResults.push({
              id: place.place_id,
              name: place.name,
              address: place.vicinity,
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
              rating: place.rating || 0,
              totalRatings: place.user_ratings_total || 0,
              isOpen: place.opening_hours?.open_now ?? null,
              businessStatus: place.business_status,
              types: place.types,
              photo: place.photos?.[0]?.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
                : null,
            });
          }
        }
      }
    }

    // Combine and sort by rating
    const allStations = [...stations, ...additionalResults]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20); // Limit to 20 results

    return NextResponse.json({
      success: true,
      stations: allStations,
      total: allStations.length,
      center: { latitude, longitude },
    });
  } catch (error) {
    console.error('Google Places search error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search stations' },
      { status: 500 }
    );
  }
}
