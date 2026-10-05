'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, useServicesStore, useOrdersStore, useStationsStore, useWashersStore, useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin, Search, Star, Clock, Car, Building,
  CheckCircle, Phone, Loader2, Heart,
  Zap, Droplets, Sparkles, Crown, RefreshCw,
  Home, Calendar, MessageCircle, User, Bell, Settings, LogOut, Wallet, Copy, Plus, ChevronRight, Headphones, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { onSoclineNotification } from '@/components/RealtimeNotifications';
import { ClientOrderFlow } from './ClientOrderFlow';
import { OrderTracking } from './OrderTracking';
import { OrderHistory } from './OrderHistory';
import { GoogleMap } from '@/components/map/GoogleMap';
// Google Places supprimé - utiliser uniquement les stations de l'app
import { AuthScreen } from './AuthScreen';
import { ChatList } from '@/components/chat/ChatList';
import { NotificationCenter } from './NotificationCenter';
import { WalletScreen } from './WalletScreen';
import { CarsManager } from './CarsManager';
import { SubscriptionPanel } from './SubscriptionPanel';
import { ActivityHistory, AddressesManager, AccountSettings } from './ClientSettings';

const navItems = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'booking', icon: Calendar, label: 'Réserver' },
  { id: 'subscriptions', icon: Crown, label: 'Abonnements' },
  { id: 'wallet', icon: Wallet, label: 'Portefeuille' },
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
  const { services, setServices, selectService } = useServicesStore();
  const { currentOrder, setCurrentOrder } = useOrdersStore();
  const { nearbyWashers, setNearbyWashers } = useWashersStore();
  const { stations, setStations } = useStationsStore();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showTracking, setShowTracking] = useState(true);
  const [promotions, setPromotions] = useState<
    Array<{
      id: string;
      name: string;
      discountType: string;
      discountValue: number;
      code?: string;
      description?: string;
      displayType?: string;
      image?: string;
      imagePosition?: string;
    }>
  >([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  // Service tab toggle: independent washers (APP services) vs. stations (STATION services)
  const [serviceTab, setServiceTab] = useState<'independent' | 'station'>('independent');
  // Stations fetched from /api/stations (with embedded services)
  const [appStations, setAppStations] = useState<any[]>([]);
  // Order presets passed to ClientOrderFlow when navigating from a service/station click
  const [presetIsHomeService, setPresetIsHomeService] = useState(true);
  const [presetStationId, setPresetStationId] = useState<string | null>(null);
  const [presetAddress, setPresetAddress] = useState('');
  // Loading state for the Home "Laveurs disponibles" section
  const [isLoadingWashers, setIsLoadingWashers] = useState(true);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWallet = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/wallet?userId=${user.id}`);
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (data.success && data.wallet) {
          setWalletBalance(data.wallet.balance);
        }
      } catch (error) {
        console.error('Error fetching wallet:', error);
      }
    };
    
    fetchWallet();
  }, [user?.id]);


  // Fetch real services from API
  useEffect(() => {
    const loadServices = async () => {
      try {
        // Seed database if needed
        const seedCheck = await fetch('/api/seed');
        if (seedCheck.ok) {
          const contentType = seedCheck.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const seedData = await seedCheck.json();
            
            if (!seedData.seeded || seedData.servicesCount === 0) {
              await fetch('/api/seed', { method: 'POST' });
            }
          }
        }

        // Fetch services - explicitly request APP source (independent washers)
        const res = await fetch('/api/services?source=APP');
        if (!res.ok) return;
        const resContentType = res.headers.get('content-type');
        if (!resContentType || !resContentType.includes('application/json')) return;
        const data = await res.json();
        
        if (data.success && data.services) {
          setServices(data.services);
          
          // Seed subscription plans after services are loaded
          await fetch('/api/subscriptions/seed', { method: 'POST' }).catch(() => {});
        }
      } catch (error) {
        console.error('Error loading services:', error);
      }
    };

    loadServices();
  }, [setServices]);

  // Fetch stations (with their embedded services) from /api/stations - for the Stations tab
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/api/stations');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.stations)) {
          setAppStations(data.stations);
        }
      } catch (error) {
        console.error('Error fetching stations:', error);
      }
    };
    fetchStations();
  }, []);

  // Fetch available washers ("Laveurs disponibles" section on Home)
  useEffect(() => {
    const fetchNearbyWashers = async () => {
      try {
        const res = await fetch('/api/washers?available=true');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.washers)) {
          setNearbyWashers(data.washers);
        }
      } catch (error) {
        console.error('Error fetching nearby washers:', error);
      } finally {
        setIsLoadingWashers(false);
      }
    };
    fetchNearbyWashers();
  }, [setNearbyWashers]);

  // Fetch active promotions
  // Note: Google Places nearby stations feature has been removed
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await fetch('/api/promotions?active=true');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
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

  // Show order tracking if active order (PENDING included so a freshly created order is tracked right away)
  if (currentOrder && showTracking && ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(currentOrder.status)) {
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
        <span className="text-white text-xs font-medium">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
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
        <div className={`flex-1 overflow-y-auto ${activeTab !== 'chat' ? 'pb-16' : ''}`}>
          {activeTab === 'home' && (
            <HomeContent
              services={services}
              nearbyWashers={nearbyWashers}
              washersLoading={isLoadingWashers}
              userLocation={userLocation}
              onStartOrder={() => {
                // No preset - user picks service in booking flow
                selectService(null);
                setPresetIsHomeService(true);
                setPresetStationId(null);
                setPresetAddress('');
                setActiveTab('booking');
              }}
              onStartOrderForService={(service, isHomeService, stationId, address) => {
                // Preset selected service + home/station context
                selectService(service);
                setPresetIsHomeService(isHomeService);
                setPresetStationId(stationId ?? null);
                setPresetAddress(address || '');
                setActiveTab('booking');
              }}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              promotions={promotions}
              currentPromoIndex={currentPromoIndex}
              setCurrentPromoIndex={setCurrentPromoIndex}
              serviceTab={serviceTab}
              setServiceTab={setServiceTab}
              appStations={appStations}
            />
          )}
          {activeTab === 'booking' && (
            <ClientOrderFlow 
              onBack={() => {
                selectService(null);
                setPresetIsHomeService(true);
                setPresetStationId(null);
                setPresetAddress('');
                setActiveTab('home');
              }} 
              onOrderComplete={() => {
                selectService(null);
                setPresetIsHomeService(true);
                setPresetStationId(null);
                setPresetAddress('');
                setActiveTab('home');
                setShowTracking(true);
              }}
              presetIsHomeService={presetIsHomeService}
              presetStationId={presetStationId}
              presetAddress={presetAddress}
            />
          )}
          {activeTab === 'subscriptions' && (
            <div className="p-4 pb-16">
              <SubscriptionPanel userId={user?.id || ''} walletBalance={walletBalance} />
            </div>
          )}
          {activeTab === 'wallet' && <WalletScreen />}
          {activeTab === 'activity' && <OrderHistory />}
          {activeTab === 'chat' && <ChatList onBack={() => setActiveTab('home')} />}
          {activeTab === 'profile' && <ProfileContent user={user} onLogout={logout} />}
        </div>
      </div>

      {/* Android Bottom Navigation - FIXED at bottom */}
      {activeTab !== 'chat' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-center h-14 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
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

      {/* Auto-popup: rate the wash as soon as it completes (realtime notification) */}
      <ReviewPopup />
    </div>
  );
}

// ---------------------------------------------------------------------
// ReviewPopup — when a wash completes, the client receives the realtime
// notification « Lavage terminé ✅ ». Catch it and open the rating popup
// right away (stars + comment + favorite washer + before/after photos).
// ---------------------------------------------------------------------
function ReviewPopup() {
  const [order, setOrder] = useState<any | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return onSoclineNotification((notif) => {
      if (notif.type !== 'order') return;
      const title = notif.title || '';
      if (!title.includes('Lavage terminé')) return;
      const data: any = notif.data || {};
      const orderId = typeof data.orderId === 'string' ? data.orderId : null;
      if (!orderId) return;
      // Fetch the order detail (washer, photos, existing review) then pop up.
      (async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          if (!res.ok) return;
          const payload = await res.json().catch(() => null);
          const fetched = payload?.order;
          if (!fetched || fetched.status !== 'COMPLETED' || fetched.review) return;
          setOrder(fetched);
        } catch {
          // best-effort — the tracking screen offers the same rating form
        }
      })();
    });
  }, []);

  const close = () => {
    setOrder(null);
    setRating(0);
    setComment('');
    setFavorite(false);
  };

  const handleSubmit = async () => {
    if (!order || rating === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, favorite }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Impossible d'envoyer votre avis");
        return;
      }
      toast.success(
        favorite
          ? 'Merci ! Avis enregistré et laveur ajouté à vos favoris ❤️'
          : 'Merci pour votre avis ⭐'
      );
      close();
    } catch {
      toast.error('Erreur réseau — avis non envoyé');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(next) => { if (!next && !isSubmitting) close(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">Notez votre lavage ⭐</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <p className="text-sm text-[#757575] text-center -mt-1">
              « {order.service?.name} » — {order.washer?.user?.name || 'votre laveur'}
            </p>

            {(order.beforePhotoUrl || order.afterPhotoUrl) && (
              <div className="grid grid-cols-2 gap-2">
                {order.beforePhotoUrl && (
                  <div>
                    <img src={order.beforePhotoUrl} alt="Voiture avant le lavage" className="w-full h-20 object-cover rounded-lg border" />
                    <p className="text-[10px] text-center text-[#757575] mt-0.5">Avant</p>
                  </div>
                )}
                {order.afterPhotoUrl && (
                  <div>
                    <img src={order.afterPhotoUrl} alt="Voiture après le lavage" className="w-full h-20 object-cover rounded-lg border" />
                    <p className="text-[10px] text-center text-[#757575] mt-0.5">Après</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  aria-label={`Noter ${star} étoile${star > 1 ? 's' : ''}`}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`w-9 h-9 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>

            <textarea
              placeholder="Commentaire (optionnel)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border border-[#E0E0E0] rounded-xl resize-none h-16 text-sm focus:outline-none focus:border-[#FF9800]"
            />

            {order.washer && (
              <button
                type="button"
                onClick={() => setFavorite((v) => !v)}
                aria-pressed={favorite}
                className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 transition-all ${
                  favorite ? 'border-red-300 bg-red-50 text-red-600' : 'border-[#E0E0E0] bg-white text-[#757575]'
                }`}
              >
                <Heart className={`w-5 h-5 ${favorite ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-sm font-medium">
                  {favorite ? `${order.washer.user?.name || 'Ce laveur'} est dans vos favoris` : `Ajouter ${order.washer.user?.name || 'ce laveur'} en favori`}
                </span>
              </button>
            )}

            <Button
              className="w-full h-11 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl"
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Envoi…' : 'Envoyer mon avis'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Home Content - Android Material Design Style
function HomeContent({
  services, nearbyWashers, washersLoading, userLocation,
  onStartOrder, onStartOrderForService, searchQuery, setSearchQuery, 
  promotions, currentPromoIndex, setCurrentPromoIndex,
  serviceTab, setServiceTab, appStations,
}: {
  services: any[]; nearbyWashers: any[]; washersLoading?: boolean;
  userLocation: any;
  onStartOrder: () => void; 
  onStartOrderForService: (service: any, isHomeService: boolean, stationId?: string | null, address?: string) => void;
  searchQuery: string; setSearchQuery: (q: string) => void;
  promotions: any[]; currentPromoIndex: number; setCurrentPromoIndex: (i: number) => void;
  serviceTab: 'independent' | 'station';
  setServiceTab: (t: 'independent' | 'station') => void;
  appStations: any[];
}) {
  const currentPromo = promotions[currentPromoIndex];
  const [selectedService, setSelectedService] = useState<any | null>(null);
  // Station clicked by the user - opens a modal showing its services
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  // "Voir tout" toggle for the available washers section (carousel ↔ full grid)
  const [showAllWashers, setShowAllWashers] = useState(false);
  const availableWashers = nearbyWashers.filter((w) => w.isAvailable);

  // Helper to safely parse a station's images JSON string into an array
  const getStationImage = (station: any): string | null => {
    try {
      const images = JSON.parse(station?.images || '[]');
      return Array.isArray(images) && images.length > 0 ? images[0] : null;
    } catch {
      return null;
    }
  };

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
                  className="w-full h-48 object-cover"
                  style={{ objectPosition: currentPromo.imagePosition || 'center' }}
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

      {/* Services section with Independent / Station toggle */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#212121]">
            {serviceTab === 'independent' ? 'Laveurs Indépendants' : 'Stations de Lavage'}
          </h3>
        </div>
        
        {/* Tab toggle */}
        <div className="bg-white rounded-lg p-1 flex gap-1 shadow-sm mb-3">
          <button
            onClick={() => setServiceTab('independent')}
            className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              serviceTab === 'independent'
                ? 'bg-[#FF9800] text-white shadow-sm'
                : 'text-[#757575]'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Indépendants</span>
          </button>
          <button
            onClick={() => setServiceTab('station')}
            className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              serviceTab === 'station'
                ? 'bg-[#FF9800] text-white shadow-sm'
                : 'text-[#757575]'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Stations</span>
          </button>
        </div>
        
        {/* Independent washers - APP services grid (home service: washer comes to client) */}
        {serviceTab === 'independent' && (
          <>
            <p className="text-xs text-[#757575] mb-2">Le laveur se déplace chez vous</p>
            <div className="grid grid-cols-4 gap-2">
              {services.length === 0 ? (
                <div className="col-span-4 bg-white rounded-lg p-4 text-center shadow-sm">
                  <p className="text-sm text-[#757575]">Aucun service disponible</p>
                </div>
              ) : services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className="bg-white rounded-lg p-3 text-center shadow-sm active:bg-[#F5F5F5] transition-colors"
                >
                  <div className="w-10 h-10 mx-auto mb-2 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
                    {(service.category === 'essentiel' || service.category === 'basic') && <Zap className="w-5 h-5 text-[#FF9800]" />}
                    {(service.category === 'confort' || service.category === 'standard') && <Droplets className="w-5 h-5 text-[#FF9800]" />}
                    {service.category === 'premium' && <Sparkles className="w-5 h-5 text-[#FF9800]" />}
                    {(service.category === 'prestige' || service.category === 'deluxe') && <Crown className="w-5 h-5 text-[#FF9800]" />}
                  </div>
                  <p className="text-xs font-medium text-[#212121] truncate">{service.name}</p>
                  <p className="text-xs text-[#FF9800] font-bold mt-0.5">{(service.price / 1000)}K</p>
                </button>
              ))}
            </div>
          </>
        )}
        
        {/* Stations list (station service: client goes to station) */}
        {serviceTab === 'station' && (
          <>
            <p className="text-xs text-[#757575] mb-2">Vous vous rendez à la station</p>
            {appStations.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                <Building className="w-8 h-8 text-[#9E9E9E] mx-auto mb-2" />
                <p className="text-sm text-[#757575]">Aucune station disponible</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appStations.map((station) => {
                  const image = getStationImage(station);
                  const serviceCount = Array.isArray(station.services) ? station.services.length : 0;
                  return (
                    <button
                      key={station.id}
                      onClick={() => setSelectedStation(station)}
                      className="w-full bg-white rounded-lg p-3 flex gap-3 shadow-sm active:bg-[#F5F5F5] transition-colors text-left"
                    >
                      {image ? (
                        <img src={image} alt={station.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building className="w-7 h-7 text-[#FF9800]" />
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
                          {serviceCount > 0 && (
                            <span className="text-xs text-[#757575]">{serviceCount} service{serviceCount > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#BDBDBD] self-center flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Service Details Modal */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left text-lg font-bold text-[#212121]">
                  {selectedService.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Service Icon & Category */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                    {(selectedService.category === 'essentiel' || selectedService.category === 'basic') && <Zap className="w-7 h-7 text-[#FF9800]" />}
                    {(selectedService.category === 'confort' || selectedService.category === 'standard') && <Droplets className="w-7 h-7 text-[#FF9800]" />}
                    {selectedService.category === 'premium' && <Sparkles className="w-7 h-7 text-[#FF9800]" />}
                    {(selectedService.category === 'prestige' || selectedService.category === 'deluxe') && <Crown className="w-7 h-7 text-[#FF9800]" />}
                  </div>
                  <div>
                    <Badge className="bg-[#FFF3E0] text-[#FF9800] capitalize">
                      {selectedService.category}
                    </Badge>
                    <p className="text-sm text-[#757575] mt-1">{selectedService.duration} minutes</p>
                  </div>
                </div>

                {/* Duration & Price Info */}
                <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl p-3">
                  <div className="flex items-center gap-2 text-[#757575]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{selectedService.duration} min</span>
                  </div>
                  <div className="flex-1" />
                  <span className="text-xl font-bold text-[#FF9800]">{selectedService.price?.toLocaleString()} XOF</span>
                </div>

                {/* Description */}
                {selectedService.description && (
                  <div>
                    <p className="text-sm font-medium text-[#212121] mb-1">Description</p>
                    <p className="text-sm text-[#757575] leading-relaxed">{selectedService.description}</p>
                  </div>
                )}

                {/* Products Used */}
                {selectedService.products && (
                  <div>
                    <p className="text-sm font-medium text-[#212121] mb-2">Produits utilisés</p>
                    <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-2">
                      {(() => {
                        try {
                          const products = JSON.parse(selectedService.products);
                          return products.map((product: string, index: number) => (
                            <div key={index} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-[#616161]">{product}</span>
                            </div>
                          ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}


                {/* Active Promotions */}
                {promotions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-[#212121] mb-2">Offres disponibles</p>
                    <div className="space-y-2">
                      {promotions.slice(0, 2).map((promo) => (
                        <div key={promo.id} className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] rounded-xl p-3 text-white">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-bold text-sm">{promo.name}</p>
                              <p className="text-xs opacity-90">
                                {promo.discountType === 'PERCENTAGE' 
                                  ? `-${promo.discountValue}% de réduction`
                                  : `-${promo.discountValue?.toLocaleString()} XOF de réduction`}
                              </p>
                            </div>
                            {promo.code && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(promo.code);
                                  toast.success('Code promo copié !');
                                }}
                                className="bg-white/20 rounded-lg px-2 py-1 text-xs font-mono"
                              >
                                {promo.code}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button - Independent washer service = home service (washer comes to client) */}
                <button
                  onClick={() => {
                    const service = selectedService;
                    setSelectedService(null);
                    onStartOrderForService(service, true);
                  }}
                  className="w-full bg-[#FF9800] hover:bg-[#F57C00] text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Réserver ce service
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Station Services Modal - shows the station's services, ordering = station service */}
      <Dialog open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedStation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left text-lg font-bold text-[#212121]">
                  {selectedStation.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Station info card */}
                <div className="bg-[#FAFAFA] rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-sm text-[#616161]">
                    <MapPin className="w-4 h-4 text-[#FF9800] mt-0.5 flex-shrink-0" />
                    <span>{selectedStation.address}</span>
                  </div>
                  {selectedStation.phone && (
                    <div className="flex items-center gap-2 text-sm text-[#616161]">
                      <Phone className="w-4 h-4 text-[#FF9800]" />
                      <span>{selectedStation.phone}</span>
                    </div>
                  )}
                  {selectedStation.rating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-[#616161]">
                      <Star className="w-4 h-4 text-[#FFC107] fill-[#FFC107]" />
                      <span>{selectedStation.rating.toFixed(1)} ({selectedStation.totalRatings} avis)</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedStation.description && (
                  <p className="text-sm text-[#757575] leading-relaxed">{selectedStation.description}</p>
                )}

                {/* Services list */}
                <div>
                  <p className="text-sm font-medium text-[#212121] mb-2">Services disponibles</p>
                  {Array.isArray(selectedStation.services) && selectedStation.services.length > 0 ? (
                    <div className="space-y-2">
                      {selectedStation.services.map((service: any) => (
                        <div key={service.id} className="bg-white border border-[#E0E0E0] rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
                              {(service.category === 'essentiel' || service.category === 'basic') && <Zap className="w-5 h-5 text-[#FF9800]" />}
                              {(service.category === 'confort' || service.category === 'standard') && <Droplets className="w-5 h-5 text-[#FF9800]" />}
                              {service.category === 'premium' && <Sparkles className="w-5 h-5 text-[#FF9800]" />}
                              {(service.category === 'prestige' || service.category === 'deluxe') && <Crown className="w-5 h-5 text-[#FF9800]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#212121] text-sm">{service.name}</p>
                              {service.description && (
                                <p className="text-xs text-[#757575] mt-0.5 line-clamp-2">{service.description}</p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-[#757575] flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {service.duration} min
                                </span>
                                <span className="text-sm font-bold text-[#FF9800]">{service.price?.toLocaleString()} XOF</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const station = selectedStation;
                              setSelectedStation(null);
                              onStartOrderForService(service, false, station.id, station.address);
                            }}
                            className="w-full mt-2 bg-[#FF9800] hover:bg-[#F57C00] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                          >
                            Réserver ce service
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#FAFAFA] rounded-lg p-4 text-center">
                      <p className="text-sm text-[#757575]">Aucun service disponible pour cette station</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Available Washers */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold text-[#212121]">Laveurs disponibles</h3>
          {!washersLoading && availableWashers.length > 4 && (
            <button
              onClick={() => setShowAllWashers(!showAllWashers)}
              className="text-xs text-[#FF9800] font-medium"
            >
              {showAllWashers ? 'Réduire' : 'Voir tout'}
            </button>
          )}
        </div>
        {washersLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-28 bg-white rounded-lg p-3 text-center shadow-sm animate-pulse">
                <div className="w-12 h-12 mx-auto mb-2 bg-[#EEEEEE] rounded-full" />
                <div className="h-3 bg-[#EEEEEE] rounded w-16 mx-auto" />
                <div className="h-3 bg-[#EEEEEE] rounded w-10 mx-auto mt-1.5" />
              </div>
            ))}
          </div>
        ) : showAllWashers ? (
          <div className="grid grid-cols-4 gap-2">
            {availableWashers.map((washer) => (
              <WasherCard key={washer.id} washer={washer} />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {availableWashers.map((washer) => (
              <div key={washer.id} className="flex-shrink-0 w-28">
                <WasherCard washer={washer} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Washer card used in the "Laveurs disponibles" section (carousel + expanded grid)
function WasherCard({ washer }: { washer: any }) {
  const name = washer.user?.name || 'Laveur';
  const jobs = washer.completedJobs ?? 0;
  return (
    <div className="w-full bg-white rounded-lg p-3 text-center shadow-sm">
      <div className="relative w-12 h-12 mx-auto mb-2">
        {washer.user?.avatar ? (
          <img src={washer.user.avatar} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 bg-[#FF9800] rounded-full flex items-center justify-center text-white font-bold">
            {name.charAt(0)}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
      </div>
      <p className="text-xs font-medium text-[#212121] truncate">{name}</p>
      <div className="flex items-center justify-center gap-0.5 mt-1">
        <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
        <span className="text-xs text-[#757575]">{(washer.rating ?? 0).toFixed(1)}</span>
      </div>
      <p className="text-[10px] text-[#9E9E9E] mt-0.5">{jobs} lavage{jobs > 1 ? 's' : ''}</p>
    </div>
  );
}

// Profile Content - Android Material Design Style
function ProfileContent({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // Real profile stats (completed washes + total spent), computed from the client's orders
  const [profileStats, setProfileStats] = useState<{ washes: number; spent: number } | null>(null);

  useEffect(() => {
    const fetchProfileStats = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/orders?userId=${user.id}`);
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const completed = data.orders.filter((o: any) => o.status === 'COMPLETED');
          setProfileStats({
            washes: completed.length,
            spent: completed.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0),
          });
        }
      } catch (error) {
        console.error('Error fetching profile stats:', error);
      }
    };
    fetchProfileStats();
  }, [user?.id]);

  // Support client info
  const supportPhone = '+22871998155';
  const supportWhatsApp = '+22871998155';

  const handleCallSupport = () => {
    window.open(`tel:${supportPhone}`, '_self');
  };

  const handleWhatsAppSupport = () => {
    const message = encodeURIComponent('Bonjour, j\'ai besoin d\'aide avec l\'application Socline.');
    window.open(`https://wa.me/${supportWhatsApp.replace(/\+/g, '')}?text=${message}`, '_blank');
  };

  // Render sub-sections if active
  if (activeSection === 'history') {
    return <ActivityHistory userId={user?.id} onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === 'addresses') {
    return <AddressesManager userId={user?.id} onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === 'settings') {
    return <AccountSettings userId={user?.id} userPhone={user?.phone} onBack={() => setActiveSection(null)} />;
  }

  return (
    <div className="p-4 space-y-3 pb-16">
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
        </div>
      </div>

      {/* Cars Section - Multi-car support */}
      <CarsManager userId={user?.id} />

      {/* Stats */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-[#212121] mb-3">Statistiques</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-[#FF9800]">
              {profileStats ? profileStats.washes : <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#FF9800]" />}
            </div>
            <div className="text-xs text-[#757575]">Lavages</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#4CAF50]">-</div>
            <div className="text-xs text-[#757575]">Note</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#2196F3]">
              {profileStats ? `${profileStats.spent.toLocaleString('fr-FR')} F` : <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#2196F3]" />}
            </div>
            <div className="text-xs text-[#757575]">Dépensé</div>
          </div>
        </div>
      </div>

      {/* Support Client */}
      <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Support Client</h3>
            <p className="text-xs text-white/80">Nous sommes là pour vous aider</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCallSupport}
            className="flex-1 bg-white rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-[#FF9800] font-medium text-sm"
          >
            <Phone className="w-4 h-4" />
            Appeler
          </button>
          <button
            onClick={handleWhatsAppSupport}
            className="flex-1 bg-[#25D366] rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-white font-medium text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </button>
        </div>
      </div>

      {/* Menu - Android List style */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        {[
          { icon: Clock, label: 'Historique', section: 'history', description: 'Toutes vos activités' },
          { icon: MapPin, label: 'Adresses', section: 'addresses', description: 'Gérez vos adresses' },
          { icon: Settings, label: 'Paramètres', section: 'settings', description: 'Modifiez votre compte' },
        ].map((item, index) => (
          <button
            key={index}
            onClick={() => setActiveSection(item.section)}
            className="w-full flex items-center gap-3 p-4 hover:bg-[#F5F5F5] active:bg-[#EEEEEE] transition-colors border-b border-[#F5F5F5] last:border-0"
          >
            <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <item.icon className="w-5 h-5 text-[#FF9800]" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[#212121] text-sm font-medium">{item.label}</span>
              <p className="text-xs text-[#9E9E9E]">{item.description}</p>
            </div>
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
