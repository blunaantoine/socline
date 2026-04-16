'use client';

import { useState, useEffect } from 'react';
import { useAppStore, useServicesStore, useOrdersStore, useStationsStore, useWashersStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin, Search, Filter, Star, Clock, Car, Navigation,
  CheckCircle, Phone, MessageCircle, ChevronRight, Loader2,
  Zap, Droplets, Sparkles, Crown, Map
} from 'lucide-react';
import { ClientOrderFlow } from './ClientOrderFlow';
import { OrderTracking } from './OrderTracking';
import { OrderHistory } from './OrderHistory';
import { GoogleMap, MapLegend } from '@/components/map/GoogleMap';

export function ClientApp() {
  const { userLocation, setUserLocation } = useAppStore();
  const { services, setServices } = useServicesStore();
  const { currentOrder } = useOrdersStore();
  const { nearbyWashers, setNearbyWashers } = useWashersStore();
  const { stations, setStations } = useStationsStore();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Demo data
  useEffect(() => {
    // Load demo services
    setServices([
      { id: '1', name: 'Lavage Express', description: 'Lavage extérieur rapide', price: 5000, duration: 20, category: 'basic', isActive: true, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Lavage Complet', description: 'Intérieur + Extérieur', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
      { id: '3', name: 'Lavage Premium', description: 'Complet + Polish + Cire', price: 15000, duration: 60, category: 'premium', isActive: true, createdAt: '', updatedAt: '' },
      { id: '4', name: 'Lavage Deluxe', description: 'Service VIP complet', price: 25000, duration: 90, category: 'deluxe', isActive: true, createdAt: '', updatedAt: '' },
    ]);

    // Load demo stations
    setStations([
      { id: '1', name: 'Auto Shine Lomé', address: 'Centre-ville, Lomé', latitude: 6.1725, longitude: 1.2314, rating: 4.8, totalRatings: 156, isActive: true, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Car Wash Bè', address: 'Bè, Lomé', latitude: 6.1685, longitude: 1.2252, rating: 4.5, totalRatings: 89, isActive: true, createdAt: '', updatedAt: '' },
    ]);

    // Load demo nearby washers
    setNearbyWashers([
      { id: '1', userId: 'w1', user: { id: 'w1', phone: '90123456', name: 'Kofi Mensah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.9, totalRatings: 234, totalEarnings: 150000, completedJobs: 156, latitude: 6.172, longitude: 1.230, address: 'Centre-ville', createdAt: '', updatedAt: '' },
      { id: '2', userId: 'w2', user: { id: 'w2', phone: '90234567', name: 'Yaw Adzimah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.7, totalRatings: 189, totalEarnings: 120000, completedJobs: 120, latitude: 6.175, longitude: 1.233, address: 'Hedzranawoé', createdAt: '', updatedAt: '' },
    ]);
  }, [setServices, setStations, setNearbyWashers]);

  // Get user location
  const getUserLocation = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: 'Votre position',
          });
          setIsLoadingLocation(false);
        },
        () => {
          // Default to Lomé
          setUserLocation({
            latitude: 6.1725,
            longitude: 1.2314,
            address: 'Lomé, Togo',
          });
          setIsLoadingLocation(false);
        }
      );
    } else {
      setUserLocation({
        latitude: 6.1725,
        longitude: 1.2314,
        address: 'Lomé, Togo',
      });
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    // Use setTimeout to defer state updates outside the effect
    const timer = setTimeout(() => {
      getUserLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // If there's an active order, show tracking
  if (currentOrder && ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(currentOrder.status)) {
    return <OrderTracking order={currentOrder} />;
  }

  return (
    <div className="pb-20">
      {/* Location Bar */}
      <div className="bg-white border-b px-4 py-3">
        <button
          onClick={getUserLocation}
          className="flex items-center gap-2 text-sm w-full"
        >
          {isLoadingLocation ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <MapPin className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-gray-700 flex-1 text-left truncate">
            {userLocation?.address || 'Localisation...'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'home' && (
        <ClientHome 
          services={services} 
          nearbyWashers={nearbyWashers}
          stations={stations}
          onStartOrder={() => setActiveTab('order')}
        />
      )}
      {activeTab === 'order' && <ClientOrderFlow onBack={() => setActiveTab('home')} />}
      {activeTab === 'history' && <OrderHistory />}
      {activeTab === 'profile' && <ClientProfile />}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
        <div className="flex justify-around py-2">
          {[
            { id: 'home', icon: MapPin, label: 'Accueil' },
            { id: 'order', icon: Car, label: 'Commander' },
            { id: 'history', icon: Clock, label: 'Historique' },
            { id: 'profile', icon: CheckCircle, label: 'Profil' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Client Home Component
function ClientHome({
  services,
  nearbyWashers,
  stations,
  onStartOrder
}: {
  services: any[];
  nearbyWashers: any[];
  stations: any[];
  onStartOrder: () => void;
}) {
  // Prepare map markers
  const mapMarkers = [
    ...nearbyWashers
      .filter(w => w.isAvailable && w.latitude && w.longitude)
      .map(washer => ({
        id: `washer-${washer.id}`,
        type: 'WASHER' as const,
        position: { lat: washer.latitude, lng: washer.longitude },
        label: washer.user.name,
        data: washer,
      })),
    ...stations
      .filter(s => s.latitude && s.longitude)
      .map(station => ({
        id: `station-${station.id}`,
        type: 'STATION' as const,
        position: { lat: station.latitude, lng: station.longitude },
        label: station.name,
        data: station,
      })),
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Map Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Carte</h2>
          <MapLegend />
        </div>
        <GoogleMap
          center={{ lat: 6.1725, lng: 1.2314 }}
          zoom={14}
          markers={mapMarkers}
          showUserLocation={true}
          height="250px"
          className="shadow-md"
        />
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Rechercher un service..."
          className="pl-10 pr-10"
        />
        <button className="absolute right-3 top-1/2 -translate-y-1/2">
          <Filter className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Quick Services */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Services populaires</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={onStartOrder}
            >
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 rounded-xl flex items-center justify-center">
                  {service.category === 'basic' && <Zap className="w-5 h-5 text-emerald-600" />}
                  {service.category === 'standard' && <Droplets className="w-5 h-5 text-emerald-600" />}
                  {service.category === 'premium' && <Sparkles className="w-5 h-5 text-emerald-600" />}
                  {service.category === 'deluxe' && <Crown className="w-5 h-5 text-emerald-600" />}
                </div>
                <h3 className="font-medium text-sm">{service.name}</h3>
                <p className="text-emerald-600 font-bold mt-1">
                  {service.price.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-gray-500">{service.duration} min</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Nearby Washers */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Laveurs disponibles</h2>
          <span className="text-sm text-blue-600 cursor-pointer">Voir tout</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {nearbyWashers.filter(w => w.isAvailable).map((washer) => (
            <Card key={washer.id} className="flex-shrink-0 w-36">
              <CardContent className="p-3 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-green-400 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold">
                  {washer.user.name?.charAt(0) || 'W'}
                </div>
                <h3 className="font-medium text-sm truncate">{washer.user.name}</h3>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs">{washer.rating.toFixed(1)}</span>
                </div>
                <Badge variant="secondary" className="mt-2 text-xs">
                  {washer.completedJobs} lavages
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stations */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Stations proches</h2>
          <span className="text-sm text-blue-600 cursor-pointer">Voir tout</span>
        </div>
        <div className="space-y-3">
          {stations.map((station) => (
            <Card key={station.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{station.name}</h3>
                  <p className="text-sm text-gray-500">{station.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm">{station.rating}</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-500">{station.totalRatings} avis</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={onStartOrder}
        className="w-full bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600 h-12 text-lg"
      >
        Commander un lavage
      </Button>
    </div>
  );
}

// Client Profile Component
function ClientProfile() {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              U
            </div>
            <div>
              <h2 className="text-xl font-semibold">Utilisateur</h2>
              <p className="text-gray-500">+228 90 12 34 56</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Statistiques</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">12</div>
              <div className="text-xs text-gray-500">Lavages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">4.8</div>
              <div className="text-xs text-gray-500">Note moyenne</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">15K</div>
              <div className="text-xs text-gray-500">Économisé</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
