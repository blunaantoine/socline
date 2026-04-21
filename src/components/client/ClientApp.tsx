'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, useServicesStore, useOrdersStore, useStationsStore, useWashersStore, useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin, Search, Star, Clock, Car,
  CheckCircle, Phone, Loader2,
  Zap, Droplets, Sparkles, Crown, RefreshCw, ExternalLink,
  Home, Calendar, MessageCircle, User, Bell, Settings, LogOut, Wallet, Copy, Plus, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientOrderFlow } from './ClientOrderFlow';
import { OrderTracking } from './OrderTracking';
import { OrderHistory } from './OrderHistory';
import { GoogleMap } from '@/components/map/GoogleMap';
import { useGooglePlaces, GooglePlaceStation } from '@/hooks/useGooglePlaces';
import { AuthScreen } from './AuthScreen';
import { ChatList } from '@/components/chat/ChatList';
import { NotificationCenter } from './NotificationCenter';
import { WalletScreen } from './WalletScreen';
import { CarsManager } from './CarsManager';

const navItems = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'booking', icon: Calendar, label: 'Réserver' },
  { id: 'wallet', icon: Wallet, label: 'Portefeuille' },
  { id: 'activity', icon: Clock, label: 'Activité' },
  { id: 'profile', icon: User, label: 'Profil' },
];

const CAR_COLORS: Record<string, string> = {
  'Noir': 'bg-gray-900',
  'Blanc': 'bg-white border border-gray-300',
  'Gris': 'bg-gray-500',
  'Argent': 'bg-gray-400',
  'Bleu': 'bg-blue-500',
  'Rouge': 'bg-red-500',
  'Vert': 'bg-green-500',
  'Marron': 'bg-amber-800',
  'Beige': 'bg-amber-200',
  'Jaune': 'bg-yellow-400',
};

export function ClientApp() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { userLocation, setUserLocation } = useAppStore();
  const { services, setServices } = useServicesStore();
  const { currentOrder, setCurrentOrder } = useOrdersStore();
  const { nearbyWashers, setNearbyWashers } = useWashersStore();
  const { stations, setStations } = useStationsStore();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showTracking, setShowTracking] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  
  const { stations: googleStations, isLoading: isLoadingStations, searchCarWashes } = useGooglePlaces();



  // Fetch real services from API
  useEffect(() => {
    const loadServices = async () => {
      try {
        // Seed database if needed
        const seedCheck = await fetch('/api/seed');
        const seedData = await seedCheck.json();
        
        if (!seedData.seeded || seedData.servicesCount === 0) {
          await fetch('/api/seed', { method: 'POST' });
        }

        // Fetch services
        const res = await fetch('/api/services');
        const data = await res.json();
        
        if (data.success && data.services) {
          setServices(data.services);
        }
      } catch (error) {
        console.error('Error loading services:', error);
      }
    };

    loadServices();
  }, [setServices]);

  // Search Google car washes
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

  // Fetch active promotions
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await fetch('/api/promotions?active=true');
        const data = await res.json();
        
        if (data.success && data.promotions.length > 0) {
          setPromotions(data.promotions);
        }
      } catch (error) {
        console.error('Error fetching promotions:', error);
      }
    };
    
    fetchPromotions();
  }, []);

  // Auto-scroll promotions carousel
  useEffect(() => {
    if (promotions.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
    }, 4000); // Change every 4 seconds
    
    return () => clearInterval(interval);
  }, [promotions]);

  // Get user location
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

  // Show auth screen if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
        <AuthScreen onComplete={() => {}} />
      </div>
    );
  }

  // Show order tracking if active order
  if (currentOrder && showTracking && ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(currentOrder.status)) {
    return (
      <OrderTracking 
        order={currentOrder} 
        onBack={() => {
          setShowTracking(false);
          if (currentOrder.status === 'COMPLETED') {
            setCurrentOrder(null);
          }
        }} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] relative">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          {/* Signal Network Bars - de petite à grande */}
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-2 bg-white rounded-sm"></div>
            <div className="w-1 h-3 bg-white rounded-sm"></div>
            <div className="w-1 h-4 bg-white rounded-sm"></div>
          </div>
          {/* Battery */}
          <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* App Bar (not shown on chat tab) */}
        {activeTab !== 'chat' && activeTab !== 'booking' && (
          <header className="bg-[#FF9800] px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <button onClick={getUserLocation} className="flex items-center gap-2">
                {isLoadingLocation ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <MapPin className="w-5 h-5 text-white" />
                )}
                <div className="text-left">
                  <p className="text-xs text-white/80">Position</p>
                  <p className="text-sm font-medium text-white truncate max-w-[140px]">{userLocation?.address || 'Lomé'}</p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
            </div>
          </header>
        )}

        {/* Content - scrollable area */}
        <div className={`flex-1 overflow-y-auto ${activeTab !== 'chat' ? 'pb-28' : ''}`}>
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
              promotions={promotions}
              currentPromoIndex={currentPromoIndex}
              setCurrentPromoIndex={setCurrentPromoIndex}
            />
          )}
          {activeTab === 'booking' && (
            <ClientOrderFlow 
              onBack={() => setActiveTab('home')} 
              onOrderComplete={() => setActiveTab('activity')}
            />
          )}
          {activeTab === 'wallet' && <WalletScreen />}
          {activeTab === 'activity' && <OrderHistory />}
          {activeTab === 'chat' && <ChatList onBack={() => setActiveTab('home')} />}
          {activeTab === 'profile' && <ProfileContent user={user} onLogout={logout} />}
        </div>
      </div>

      {/* Android Bottom Navigation - FIXED at bottom */}
      {activeTab !== 'chat' && (
        <nav className="fixed bottom-10 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-center h-14 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-4 transition-all ${
                  isActive ? 'text-[#FF9800]' : 'text-[#757575]'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Android Navigation Bar - FIXED at very bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-black flex items-center justify-center gap-16 z-50">
        <button className="w-8 h-8 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white rounded-full"></div>
        </button>
        <button className="w-8 h-8 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white rounded"></div>
        </button>
        <button className="w-8 h-8 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white rotate-45"></div>
        </button>
      </div>
    </div>
  );
}

// Home Content - Android Material Design Style
function HomeContent({
  services, nearbyWashers, googleStations, isLoadingStations, userLocation,
  onRefresh, onStartOrder, searchQuery, setSearchQuery, 
  promotions, currentPromoIndex, setCurrentPromoIndex,
}: {
  services: any[]; nearbyWashers: any[]; googleStations: GooglePlaceStation[];
  isLoadingStations: boolean; userLocation: any; onRefresh: () => void;
  onStartOrder: () => void; searchQuery: string; setSearchQuery: (q: string) => void;
  promotions: any[]; currentPromoIndex: number; setCurrentPromoIndex: (i: number) => void;
}) {
  const currentPromo = promotions[currentPromoIndex];

  return (
    <div className="p-4 space-y-4">
      {/* Search - Android style */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
        <Input
          placeholder="Rechercher un service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 bg-white border-0 rounded-lg text-sm shadow-sm"
        />
      </div>

      {/* Hero Banner - Promotions Carousel with auto-scroll */}
      {promotions.length > 0 && currentPromo && (
        <div className="relative overflow-hidden">
          <div 
            key={currentPromoIndex}
            className="rounded-lg shadow-md animate-slide-in overflow-hidden"
          >
            {currentPromo.displayType === 'IMAGE' && currentPromo.image ? (
              // Image mode - show image only, code can be copied via button below
              <div className="relative">
                <img 
                  src={currentPromo.image} 
                  alt={currentPromo.name}
                  className="w-full h-36 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold text-sm">
                        {currentPromo.discountType === 'PERCENTAGE' 
                          ? `-${currentPromo.discountValue}%` 
                          : `-${currentPromo.discountValue.toLocaleString()}F`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {currentPromo.code && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentPromo.code!);
                            toast.success('Code promo copié !');
                          }}
                          className="bg-white/20 backdrop-blur rounded px-2 py-1 inline-flex items-center gap-1 hover:bg-white/30 transition-colors active:scale-95"
                        >
                          <Copy className="w-3 h-3 text-white" />
                          <span className="text-white text-xs">Copier le code</span>
                        </button>
                      )}
                      <button
                        onClick={onStartOrder}
                        className="bg-white text-[#FF9800] px-3 py-1 rounded text-xs font-semibold"
                      >
                        Réserver
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Text mode - show gradient background with all details
              <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-4">
                <p className="text-white/90 text-xs font-medium mb-1">Offre spéciale</p>
                <h2 className="text-white text-lg font-bold mb-2">
                  {currentPromo.discountType === 'PERCENTAGE' 
                    ? `-${currentPromo.discountValue}% ${currentPromo.name}`
                    : `-${currentPromo.discountValue.toLocaleString()}F ${currentPromo.name}`}
                </h2>
                {currentPromo.description && (
                  <p className="text-white/80 text-sm mb-2">{currentPromo.description}</p>
                )}
                {currentPromo.code && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentPromo.code!);
                      toast.success('Code promo copié !');
                    }}
                    className="bg-white/20 rounded px-3 py-1.5 inline-flex items-center gap-2 mb-3 hover:bg-white/30 transition-colors active:scale-95"
                  >
                    <span className="text-white font-mono text-sm font-bold">{currentPromo.code}</span>
                    <Copy className="w-4 h-4 text-white/80" />
                  </button>
                )}
                <button
                  onClick={onStartOrder}
                  className="bg-white text-[#FF9800] px-4 py-2 rounded text-sm font-semibold"
                >
                  Réserver
                </button>
              </div>
            )}
          </div>
          
          {/* Carousel Dots Indicator */}
          {promotions.length > 1 && (
            <div className="flex justify-center gap-2 mt-3">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPromoIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentPromoIndex 
                      ? 'w-6 bg-[#FF9800]' 
                      : 'w-2 bg-[#BDBDBD]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Services - Android style */}
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
              className="bg-white rounded-lg p-3 text-center shadow-sm active:bg-[#F5F5F5] transition-colors"
            >
              <div className="w-10 h-10 mx-auto mb-2 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
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
            <div key={washer.id} className="flex-shrink-0 w-28 bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="relative w-12 h-12 mx-auto mb-2">
                <div className="w-12 h-12 bg-[#FF9800] rounded-full flex items-center justify-center text-white font-bold">
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
          <div className="bg-white rounded-lg p-6 text-center shadow-sm">
            <MapPin className="w-8 h-8 text-[#9E9E9E] mx-auto mb-2" />
            <p className="text-sm text-[#757575]">Aucune station trouvée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {googleStations.slice(0, 4).map((station) => (
              <div key={station.id} className="bg-white rounded-lg p-3 flex gap-3 shadow-sm">
                {station.photo ? (
                  <img src={station.photo} alt={station.name} className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
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
                  className="w-8 h-8 bg-[#FFF3E0] rounded flex items-center justify-center self-center"
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

// Profile Content - Android Material Design Style
function ProfileContent({ user, onLogout }: { user: any; onLogout: () => void }) {
  return (
    <div className="p-4 space-y-3 pb-28">
      {/* Profile Card - Android style */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-[#FF9800] rounded-full flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[#212121]">{user?.name || 'Utilisateur'}</h2>
            <p className="text-sm text-[#757575]">+228 {user?.phone || '90 12 34 56'}</p>
          </div>
          <button className="w-8 h-8 bg-[#FFF3E0] rounded flex items-center justify-center">
            <Settings className="w-4 h-4 text-[#FF9800]" />
          </button>
        </div>
      </div>

      {/* Cars Section - Multi-car support */}
      <CarsManager userId={user?.id} />

      {/* Stats */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-[#212121] mb-3">Statistiques</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-[#FF9800]">0</div>
            <div className="text-xs text-[#757575]">Lavages</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#4CAF50]">-</div>
            <div className="text-xs text-[#757575]">Note</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#2196F3]">0F</div>
            <div className="text-xs text-[#757575]">Économisé</div>
          </div>
        </div>
      </div>

      {/* Menu - Android List style */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        {[
          { icon: Clock, label: 'Historique' },
          { icon: MapPin, label: 'Adresses' },
          { icon: Settings, label: 'Paramètres' },
        ].map((item, index) => (
          <button
            key={index}
            className="w-full flex items-center gap-3 p-4 hover:bg-[#F5F5F5] transition-colors border-b border-[#F5F5F5] last:border-0"
          >
            <div className="w-8 h-8 bg-[#FFF3E0] rounded flex items-center justify-center">
              <item.icon className="w-4 h-4 text-[#FF9800]" />
            </div>
            <span className="flex-1 text-left text-[#212121] text-sm">{item.label}</span>
            <ChevronRight className="w-5 h-5 text-[#BDBDBD]" />
          </button>
        ))}
      </div>

      {/* Logout Button - Android style */}
      <button
        onClick={onLogout}
        className="w-full h-12 border border-[#E0E0E0] text-red-500 bg-white rounded-lg font-semibold text-sm active:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4 inline mr-2" />
        Déconnexion
      </button>
    </div>
  );
}
