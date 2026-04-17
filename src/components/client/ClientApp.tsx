'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, useServicesStore, useOrdersStore, useStationsStore, useWashersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin, Search, Star, Clock, Car, Navigation,
  CheckCircle, Phone, ChevronRight, Loader2,
  Zap, Droplets, Sparkles, Crown, Map, RefreshCw, ExternalLink,
  Home, Calendar, MessageCircle, User, Settings, Filter
} from 'lucide-react';
import { ClientOrderFlow } from './ClientOrderFlow';
import { OrderTracking } from './OrderTracking';
import { OrderHistory } from './OrderHistory';
import { GoogleMap, MapLegend } from '@/components/map/GoogleMap';
import { useGooglePlaces, GooglePlaceStation } from '@/hooks/useGooglePlaces';

// Navigation items
const navItems = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'services', icon: Zap, label: 'Services' },
  { id: 'booking', icon: Calendar, label: 'Réservation' },
  { id: 'chat', icon: MessageCircle, label: 'Messages' },
  { id: 'profile', icon: User, label: 'Profil' },
];

export function ClientApp() {
  const { userLocation, setUserLocation } = useAppStore();
  const { services, setServices } = useServicesStore();
  const { currentOrder } = useOrdersStore();
  const { nearbyWashers, setNearbyWashers } = useWashersStore();
  const { stations, setStations } = useStationsStore();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // Use the Google Places hook
  const { stations: googleStations, isLoading: isLoadingStations, searchCarWashes } = useGooglePlaces();

  // Demo data
  useEffect(() => {
    setServices([
      { id: '1', name: 'Lavage Express', description: 'Lavage extérieur rapide', price: 5000, duration: 20, category: 'basic', isActive: true, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Lavage Complet', description: 'Intérieur + Extérieur', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
      { id: '3', name: 'Lavage Premium', description: 'Complet + Polish + Cire', price: 15000, duration: 60, category: 'premium', isActive: true, createdAt: '', updatedAt: '' },
      { id: '4', name: 'Lavage Deluxe', description: 'Service VIP complet', price: 25000, duration: 90, category: 'deluxe', isActive: true, createdAt: '', updatedAt: '' },
    ]);

    setNearbyWashers([
      { id: '1', userId: 'w1', user: { id: 'w1', phone: '90123456', name: 'Kofi Mensah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.9, totalRatings: 234, totalEarnings: 150000, completedJobs: 156, latitude: 6.172, longitude: 1.230, address: 'Centre-ville', createdAt: '', updatedAt: '' },
      { id: '2', userId: 'w2', user: { id: 'w2', phone: '90234567', name: 'Yaw Adzimah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.7, totalRatings: 189, totalEarnings: 120000, completedJobs: 120, latitude: 6.175, longitude: 1.233, address: 'Hedzranawoé', createdAt: '', updatedAt: '' },
      { id: '3', userId: 'w3', user: { id: 'w3', phone: '90345678', name: 'Kwame Asante', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.8, totalRatings: 156, totalEarnings: 95000, completedJobs: 98, latitude: 6.170, longitude: 1.228, address: 'Adidogomé', createdAt: '', updatedAt: '' },
    ]);
  }, [setServices, setNearbyWashers]);

  // Fetch stations when location changes
  useEffect(() => {
    if (userLocation) {
      searchCarWashes(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, searchCarWashes]);

  // Update store when Google stations change
  useEffect(() => {
    if (googleStations.length > 0) {
      const formattedStations = googleStations.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        rating: s.rating,
        totalRatings: s.totalRatings,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      setStations(formattedStations);
    }
  }, [googleStations, setStations]);

  // Get user location
  const getUserLocation = useCallback(() => {
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
  }, [setUserLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      getUserLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, [getUserLocation]);

  // If there's an active order, show tracking
  if (currentOrder && ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(currentOrder.status)) {
    return <OrderTracking order={currentOrder} />;
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-[#212121]">WashGo</h1>
            <p className="text-xs text-[#757575]">Votre lavage auto à domicile</p>
          </div>
          <button 
            onClick={getUserLocation}
            className="flex items-center gap-1 text-sm text-[#757575]"
          >
            {isLoadingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#FF9800]" />
            ) : (
              <MapPin className="w-4 h-4 text-[#FF9800]" />
            )}
            <span className="truncate max-w-[120px]">{userLocation?.address || 'Lomé'}</span>
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
          <Input
            placeholder="Quel service recherchez-vous ?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-12 h-11 bg-[#F5F5F5] border-0 rounded-xl text-[#212121] placeholder:text-[#9E9E9E]"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#FF9800] rounded-lg flex items-center justify-center">
            <Filter className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* Filter Chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'express', label: 'Express' },
            { id: 'complet', label: 'Complet' },
            { id: 'premium', label: 'Premium' },
            { id: 'deluxe', label: 'Deluxe' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === filter.id
                  ? 'bg-[#FF9800] text-white'
                  : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#FFE0B2]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && (
          <HomeContent
            services={services}
            nearbyWashers={nearbyWashers}
            googleStations={googleStations}
            isLoadingStations={isLoadingStations}
            userLocation={userLocation}
            onRefresh={() => {
              if (userLocation) {
                searchCarWashes(userLocation.latitude, userLocation.longitude);
              }
            }}
            onStartOrder={() => setActiveTab('booking')}
          />
        )}
        {activeTab === 'services' && <ServicesContent services={services} onStartOrder={() => setActiveTab('booking')} />}
        {activeTab === 'booking' && <ClientOrderFlow onBack={() => setActiveTab('home')} />}
        {activeTab === 'chat' && <ChatContent />}
        {activeTab === 'profile' && <ProfileContent />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#F5F5F5] z-50">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
                  isActive ? 'text-[#FF9800]' : 'text-[#9E9E9E]'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'fill-[#FF9800]/20' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Home Content Component
function HomeContent({
  services,
  nearbyWashers,
  googleStations,
  isLoadingStations,
  userLocation,
  onRefresh,
  onStartOrder,
}: {
  services: any[];
  nearbyWashers: any[];
  googleStations: GooglePlaceStation[];
  isLoadingStations: boolean;
  userLocation: { latitude: number; longitude: number; address: string } | null;
  onRefresh: () => void;
  onStartOrder: () => void;
}) {
  const displayStations = googleStations.length > 0 ? googleStations : [];
  
  return (
    <div className="p-4 space-y-6">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-[#FF9800] to-[#F57C00] rounded-2xl p-4 overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h2 className="text-white text-lg font-bold mb-1">Besoin d'un lavage ?</h2>
          <p className="text-white/90 text-sm mb-3">Réservez en quelques clics</p>
          <Button
            onClick={onStartOrder}
            className="bg-white text-[#FF9800] hover:bg-white/90 font-semibold px-6"
          >
            Réserver maintenant
          </Button>
        </div>
      </div>

      {/* Popular Services */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-[#212121]">Services populaires</h3>
          <button className="text-sm text-[#FF9800] font-medium">Voir tout</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={onStartOrder}
              className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                {service.category === 'basic' && <Zap className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'standard' && <Droplets className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'premium' && <Sparkles className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'deluxe' && <Crown className="w-5 h-5 text-[#FF9800]" />}
              </div>
              <h4 className="text-xs font-medium text-[#212121] truncate">{service.name}</h4>
              <p className="text-xs text-[#FF9800] font-bold mt-1">
                {(service.price / 1000).toFixed(0)}K FCFA
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Available Washers */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-[#212121]">Laveurs disponibles</h3>
          <button className="text-sm text-[#FF9800] font-medium">Voir tout</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {nearbyWashers.filter(w => w.isAvailable).map((washer) => (
            <Card key={washer.id} className="flex-shrink-0 w-36 bg-white shadow-sm border-0">
              <CardContent className="p-3 text-center">
                <div className="relative w-14 h-14 mx-auto mb-2">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {washer.user.name?.charAt(0) || 'W'}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                <h4 className="font-medium text-sm text-[#212121] truncate">{washer.user.name}</h4>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                  <span className="text-xs text-[#757575]">{washer.rating.toFixed(1)}</span>
                  <span className="text-xs text-[#9E9E9E]">({washer.completedJobs})</span>
                </div>
                <Badge className="mt-2 bg-[#FFF3E0] text-[#FF9800] hover:bg-[#FFE0B2] text-xs">
                  Disponible
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Nearby Stations */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-[#212121] flex items-center gap-2">
            Stations proches
            {googleStations.length > 0 && (
              <Badge className="bg-[#4CAF50] text-white text-xs">Google</Badge>
            )}
          </h3>
          <button
            onClick={onRefresh}
            disabled={isLoadingStations}
            className="text-sm text-[#FF9800] font-medium flex items-center gap-1"
          >
            {isLoadingStations ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>

        {isLoadingStations && displayStations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF9800]" />
            <span className="ml-2 text-[#757575]">Recherche...</span>
          </div>
        ) : displayStations.length === 0 ? (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-[#9E9E9E] mx-auto mb-2" />
              <p className="text-[#757575]">Aucune station trouvée</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onRefresh}>
                Actualiser
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayStations.slice(0, 5).map((station) => (
              <Card key={station.id} className="bg-white shadow-sm border-0 overflow-hidden">
                <CardContent className="p-3 flex gap-3">
                  {'photo' in station && station.photo ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#F5F5F5]">
                      <img src={station.photo} alt={station.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-[#FF9800]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#212121] truncate">{station.name}</h4>
                    <p className="text-xs text-[#757575] truncate">{station.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {station.rating > 0 && (
                        <>
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                            <span className="text-xs text-[#757575]">{station.rating.toFixed(1)}</span>
                          </div>
                          <span className="text-[#9E9E9E] text-xs">({station.totalRatings})</span>
                        </>
                      )}
                      {'isOpen' in station && station.isOpen !== null && (
                        <Badge className={`text-xs ${station.isOpen ? 'bg-[#E8F5E9] text-[#4CAF50]' : 'bg-[#FFEBEE] text-[#F44336]'}`}>
                          {station.isOpen ? 'Ouvert' : 'Fermé'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFF3E0] text-[#FF9800]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Services Content
function ServicesContent({ services, onStartOrder }: { services: any[]; onStartOrder: () => void }) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-[#212121]">Nos Services</h2>
      <div className="space-y-3">
        {services.map((service) => (
          <Card key={service.id} className="bg-white shadow-sm border-0 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-14 h-14 bg-[#FFF3E0] rounded-xl flex items-center justify-center flex-shrink-0">
                  {service.category === 'basic' && <Zap className="w-6 h-6 text-[#FF9800]" />}
                  {service.category === 'standard' && <Droplets className="w-6 h-6 text-[#FF9800]" />}
                  {service.category === 'premium' && <Sparkles className="w-6 h-6 text-[#FF9800]" />}
                  {service.category === 'deluxe' && <Crown className="w-6 h-6 text-[#FF9800]" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#212121]">{service.name}</h3>
                  <p className="text-sm text-[#757575]">{service.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#FF9800]">{service.price.toLocaleString()} FCFA</span>
                      <span className="text-xs text-[#9E9E9E]">{service.duration} min</span>
                    </div>
                    <Button size="sm" onClick={onStartOrder} className="bg-[#FF9800] hover:bg-[#F57C00]">
                      Réserver
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Chat Content
function ChatContent() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      <MessageCircle className="w-16 h-16 text-[#9E9E9E] mb-4" />
      <h3 className="text-lg font-semibold text-[#212121] mb-2">Aucun message</h3>
      <p className="text-[#757575] text-center">Vos conversations avec les laveurs apparaîtront ici</p>
    </div>
  );
}

// Profile Content
function ProfileContent() {
  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-2xl font-bold">
              U
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#212121]">Utilisateur</h2>
              <p className="text-[#757575]">+228 90 12 34 56</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#212121] mb-3">Statistiques</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#FF9800]">12</div>
              <div className="text-xs text-[#757575]">Lavages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4CAF50]">4.8</div>
              <div className="text-xs text-[#757575]">Note</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#2196F3]">15K</div>
              <div className="text-xs text-[#757575]">Économisé</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="p-0">
          {[
            { icon: Car, label: 'Mes véhicules', action: () => {} },
            { icon: Clock, label: 'Historique', action: () => {} },
            { icon: MapPin, label: 'Adresses sauvegardées', action: () => {} },
            { icon: Settings, label: 'Paramètres', action: () => {} },
          ].map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 hover:bg-[#F5F5F5] transition-colors border-b border-[#F5F5F5] last:border-0"
            >
              <item.icon className="w-5 h-5 text-[#FF9800]" />
              <span className="flex-1 text-left text-[#212121]">{item.label}</span>
              <ChevronRight className="w-5 h-5 text-[#9E9E9E]" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
