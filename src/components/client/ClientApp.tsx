'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, useServicesStore, useOrdersStore, useStationsStore, useWashersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin, Search, Star, Clock, Car,
  CheckCircle, Phone, Loader2,
  Zap, Droplets, Sparkles, Crown, RefreshCw, ExternalLink,
  Home, Calendar, MessageCircle, User, Bell, Settings
} from 'lucide-react';
import { ClientOrderFlow } from './ClientOrderFlow';
import { OrderTracking } from './OrderTracking';
import { OrderHistory } from './OrderHistory';
import { GoogleMap } from '@/components/map/GoogleMap';
import { useGooglePlaces, GooglePlaceStation } from '@/hooks/useGooglePlaces';

const navItems = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'booking', icon: Calendar, label: 'Réserver' },
  { id: 'activity', icon: Clock, label: 'Activité' },
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
  
  const { stations: googleStations, isLoading: isLoadingStations, searchCarWashes } = useGooglePlaces();

  useEffect(() => {
    setServices([
      { id: '1', name: 'Express', description: 'Lavage extérieur rapide', price: 5000, duration: 20, category: 'basic', isActive: true, createdAt: '', updatedAt: '' },
      { id: '2', name: 'Complet', description: 'Intérieur + Extérieur', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
      { id: '3', name: 'Premium', description: 'Complet + Polish + Cire', price: 15000, duration: 60, category: 'premium', isActive: true, createdAt: '', updatedAt: '' },
      { id: '4', name: 'Deluxe', description: 'Service VIP complet', price: 25000, duration: 90, category: 'deluxe', isActive: true, createdAt: '', updatedAt: '' },
    ]);

    setNearbyWashers([
      { id: '1', userId: 'w1', user: { id: 'w1', phone: '90123456', name: 'Kofi Mensah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.9, totalRatings: 234, totalEarnings: 150000, completedJobs: 156, latitude: 6.172, longitude: 1.230, address: 'Centre-ville', createdAt: '', updatedAt: '' },
      { id: '2', userId: 'w2', user: { id: 'w2', phone: '90234567', name: 'Yaw Adzimah', role: 'WASHER', isActive: true, createdAt: '', updatedAt: '' }, isAvailable: true, isVerified: true, rating: 4.7, totalRatings: 189, totalEarnings: 120000, completedJobs: 120, latitude: 6.175, longitude: 1.233, address: 'Hedzranawoé', createdAt: '', updatedAt: '' },
    ]);
  }, [setServices, setNearbyWashers]);

  useEffect(() => {
    if (userLocation) {
      searchCarWashes(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, searchCarWashes]);

  useEffect(() => {
    if (googleStations.length > 0) {
      const formattedStations = googleStations.map(s => ({
        id: s.id, name: s.name, address: s.address,
        latitude: s.latitude, longitude: s.longitude,
        rating: s.rating, totalRatings: s.totalRatings,
        isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }));
      setStations(formattedStations);
    }
  }, [googleStations, setStations]);

  const getUserLocation = useCallback(() => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, address: 'Ma position' });
          setIsLoadingLocation(false);
        },
        () => {
          setUserLocation({ latitude: 6.1725, longitude: 1.2314, address: 'Lomé, Togo' });
          setIsLoadingLocation(false);
        }
      );
    } else {
      setUserLocation({ latitude: 6.1725, longitude: 1.2314, address: 'Lomé, Togo' });
      setIsLoadingLocation(false);
    }
  }, [setUserLocation]);

  useEffect(() => {
    const timer = setTimeout(getUserLocation, 0);
    return () => clearTimeout(timer);
  }, [getUserLocation]);

  if (currentOrder && ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(currentOrder.status)) {
    return <OrderTracking order={currentOrder} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0] overflow-hidden">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={getUserLocation} className="flex items-center gap-2">
            {isLoadingLocation ? (
              <Loader2 className="w-5 h-5 text-[#FF9800] animate-spin" />
            ) : (
              <MapPin className="w-5 h-5 text-[#FF9800]" />
            )}
            <div className="text-left">
              <p className="text-xs text-[#757575]">Position</p>
              <p className="text-sm font-medium text-[#212121] truncate max-w-[140px]">{userLocation?.address || 'Lomé'}</p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#FF9800]" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && (
          <HomeContent
            services={services}
            nearbyWashers={nearbyWashers}
            googleStations={googleStations}
            isLoadingStations={isLoadingStations}
            userLocation={userLocation}
            onRefresh={() => userLocation && searchCarWashes(userLocation.latitude, userLocation.longitude)}
            onStartOrder={() => setActiveTab('booking')}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
        )}
        {activeTab === 'booking' && <ClientOrderFlow onBack={() => setActiveTab('home')} />}
        {activeTab === 'activity' && <OrderHistory />}
        {activeTab === 'chat' && <ChatContent />}
        {activeTab === 'profile' && <ProfileContent />}
      </div>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#F5F5F5] flex justify-around items-center py-2 px-2 z-50">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-[#FF9800]' : 'text-[#9E9E9E]'
              }`}
            >
              <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'bg-[#FFF3E0] rounded-lg' : ''}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Home Content
function HomeContent({
  services, nearbyWashers, googleStations, isLoadingStations, userLocation,
  onRefresh, onStartOrder, searchQuery, setSearchQuery, activeFilter, setActiveFilter,
}: {
  services: any[]; nearbyWashers: any[]; googleStations: GooglePlaceStation[];
  isLoadingStations: boolean; userLocation: any; onRefresh: () => void;
  onStartOrder: () => void; searchQuery: string; setSearchQuery: (q: string) => void;
  activeFilter: string; setActiveFilter: (f: string) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
        <Input
          placeholder="Rechercher un service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-white border-[#FFE0B2] rounded-xl text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {[
          { id: 'all', label: 'Tout' },
          { id: 'express', label: 'Express' },
          { id: 'complet', label: 'Complet' },
          { id: 'premium', label: 'Premium' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilter === filter.id
                ? 'bg-[#FF9800] text-white'
                : 'bg-white text-[#757575] border border-[#E0E0E0]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-white/90 text-xs font-medium mb-1">Offre spéciale</p>
          <h2 className="text-white text-lg font-bold mb-2">-20% sur votre 1er lavage</h2>
          <button
            onClick={onStartOrder}
            className="bg-white text-[#FF9800] px-4 py-2 rounded-xl text-sm font-semibold"
          >
            Réserver
          </button>
        </div>
      </div>

      {/* Services */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#212121]">Nos Services</h3>
          <button className="text-xs text-[#FF9800] font-medium">Voir tout</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={onStartOrder}
              className="bg-white rounded-2xl p-3 text-center active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                {service.category === 'basic' && <Zap className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'standard' && <Droplets className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'premium' && <Sparkles className="w-5 h-5 text-[#FF9800]" />}
                {service.category === 'deluxe' && <Crown className="w-5 h-5 text-[#FF9800]" />}
              </div>
              <p className="text-xs font-medium text-[#212121] truncate">{service.name}</p>
              <p className="text-xs text-[#FF9800] font-bold mt-0.5">{(service.price / 1000)}K</p>
            </button>
          ))}
        </div>
      </section>

      {/* Available Washers */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#212121]">Laveurs disponibles</h3>
          <button className="text-xs text-[#FF9800] font-medium">Voir tout</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {nearbyWashers.filter(w => w.isAvailable).map((washer) => (
            <div key={washer.id} className="flex-shrink-0 w-28 bg-white rounded-2xl p-3 text-center">
              <div className="relative w-12 h-12 mx-auto mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white font-bold">
                  {washer.user.name?.charAt(0)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <p className="text-xs font-medium text-[#212121] truncate">{washer.user.name}</p>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                <span className="text-xs text-[#757575]">{washer.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stations */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#212121]">Stations proches</h3>
          <button onClick={onRefresh} disabled={isLoadingStations} className="text-xs text-[#FF9800] font-medium flex items-center gap-1">
            {isLoadingStations ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </button>
        </div>
        
        {isLoadingStations && googleStations.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF9800]" />
          </div>
        ) : googleStations.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center">
            <MapPin className="w-8 h-8 text-[#9E9E9E] mx-auto mb-2" />
            <p className="text-sm text-[#757575]">Aucune station trouvée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {googleStations.slice(0, 4).map((station) => (
              <div key={station.id} className="bg-white rounded-2xl p-3 flex gap-3">
                {station.photo ? (
                  <img src={station.photo} alt={station.name} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-[#FF9800]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#212121] text-sm truncate">{station.name}</p>
                  <p className="text-xs text-[#757575] truncate">{station.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {station.rating > 0 && (
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                        <span className="text-xs text-[#757575]">{station.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {station.isOpen !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${station.isOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {station.isOpen ? 'Ouvert' : 'Fermé'}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 bg-[#FFF3E0] rounded-lg flex items-center justify-center self-center"
                >
                  <ExternalLink className="w-4 h-4 text-[#FF9800]" />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Chat Content
function ChatContent() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 bg-[#FFF3E0] rounded-full flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-[#FF9800]" />
      </div>
      <h3 className="text-lg font-semibold text-[#212121] mb-1">Aucun message</h3>
      <p className="text-[#757575] text-sm text-center">Vos conversations apparaîtront ici</p>
    </div>
  );
}

// Profile Content
function ProfileContent() {
  return (
    <div className="p-4 space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-xl font-bold">
            U
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[#212121]">Utilisateur</h2>
            <p className="text-sm text-[#757575]">+228 90 12 34 56</p>
          </div>
          <button className="w-8 h-8 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4 text-[#FF9800]" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl p-4">
        <h3 className="font-semibold text-[#212121] mb-3">Statistiques</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-[#FF9800]">12</div>
            <div className="text-xs text-[#757575]">Lavages</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#4CAF50]">4.8</div>
            <div className="text-xs text-[#757575]">Note</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#2196F3]">15K</div>
            <div className="text-xs text-[#757575]">Économisé</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl overflow-hidden">
        {[
          { icon: Car, label: 'Mes véhicules' },
          { icon: Clock, label: 'Historique' },
          { icon: MapPin, label: 'Adresses' },
          { icon: Settings, label: 'Paramètres' },
        ].map((item, index) => (
          <button
            key={index}
            className="w-full flex items-center gap-3 p-4 hover:bg-[#F5F5F5] transition-colors border-b border-[#F5F5F5] last:border-0"
          >
            <div className="w-8 h-8 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
              <item.icon className="w-4 h-4 text-[#FF9800]" />
            </div>
            <span className="flex-1 text-left text-[#212121] text-sm">{item.label}</span>
            <div className="w-5 h-5 text-[#9E9E9E]">›</div>
          </button>
        ))}
      </div>
    </div>
  );
}
