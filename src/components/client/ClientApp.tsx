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
  MapPin, Search, Star, Clock, Car, Building, Armchair,
  CheckCircle, Phone, Loader2, Heart,
  Zap, Droplets, Sparkles, Crown, RefreshCw,
  Home, Calendar, MessageCircle, User, Bell, Settings, LogOut, Wallet, Copy, Plus, ChevronRight, Headphones, MessageSquare, Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { onSoclineNotification } from '@/components/RealtimeNotifications';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
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
import { ServiceIcon, CoverageBadge, CoverageDetails } from '@/components/shared/ServiceCoverage';
import { formatPrice, getServiceCoverage } from '@/lib/service-coverage';
import { MediaCarousel } from './MediaCarousel';
// Design System — composants réutilisables (refonte UI)
import { SectionHeader } from '@/components/design/SectionHeader';
import { Segmented } from '@/components/design/Segmented';
import { ServiceArtCard } from '@/components/design/ServiceArtCard';
import { WasherRow } from '@/components/design/WasherRow';
import { EmptyState } from '@/components/design/EmptyState';
import { CARD_CLASSES } from '@/lib/design-system';

const navItems = [
  { id: 'home', icon: Home, label: 'Accueil' },
  { id: 'booking', icon: Calendar, label: 'Réserver' },
  { id: 'subscriptions', icon: Crown, label: 'Abonnements' },
  { id: 'wallet', icon: Wallet, label: 'Portefeuille' },
  { id: 'profile', icon: User, label: 'Profil' },
];

// Titre de l'en-tête selon l'onglet actif — libellés courts (design system)
const HEADER_TITLES: Record<string, string> = {
  home: "Quel lavage aujourd'hui ?",
  subscriptions: 'Abonnements',
  wallet: 'Portefeuille',
  profile: 'Profil',
  activity: 'Activité',
};

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
      video?: string;
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

  // Retour de la page de paiement PayDunya (return_url = /?paydunya=return) :
  // ouvrir directement l'onglet Portefeuille — son poller détecte le dépôt
  // PENDING et crédite le solde dès que PayDunya confirme le paiement.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('paydunya') === 'return') {
      params.delete('paydunya');
      const qs = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}`
      );
      setActiveTab('wallet');
      toast.info('Retour de PayDunya — vérification de votre paiement en cours…');
    }
  }, []);

  // Fetch wallet balance — auto-refresh 45 s + retour sur l'app
  const fetchWallet = useCallback(async () => {
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
  }, [user?.id]);

  useAutoRefresh(fetchWallet, 45000);

  // ---------------------------------------------------------------------
  // Reprendre la prestation en cours après une fermeture / rechargement de
  // la page : si le client a une commande active (recherche de laveur,
  // acceptée, en route, arrivé, lavage en cours), on restaure le suivi
  // automatiquement — il n'a rien à chercher, l'app le ramène sur l'écran
  // de suivi dès l'ouverture.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const restoreActiveOrder = async () => {
      if (!user?.id) return;
      try {
        // GET /api/orders is session-scoped — returns this client's orders.
        const res = await fetch('/api/orders');
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.orders)) return;
        const active = data.orders.find((o: { status: string }) =>
          ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)
        );
        if (active) {
          setCurrentOrder(active);
          setShowTracking(true);
          toast.info('Vous avez une commande en cours — reprise du suivi 📍', {
            id: 'order-restore',
          });
        }
      } catch {
        // Best-effort — the client can still open the tracking from history.
      }
    };

    restoreActiveOrder();
    // Run once per login session — currentOrder changes must NOT retrigger it.
  }, [user?.id]);



  // Fetch real services from API — auto-refresh 60 s + retour sur l'app
  const loadServices = useCallback(async (source: 'initial' | 'interval' | 'focus' = 'initial') => {
    try {
      // Seed database if needed (au premier chargement uniquement)
      if (source === 'initial') {
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
      }

      // Fetch services - explicitly request APP source (independent washers)
      const res = await fetch('/api/services?source=APP');
      if (!res.ok) return;
      const resContentType = res.headers.get('content-type');
      if (!resContentType || !resContentType.includes('application/json')) return;
      const data = await res.json();

      if (data.success && data.services) {
        setServices(data.services);

        // Seed subscription plans after services are loaded (premier chargement)
        if (source === 'initial') {
          await fetch('/api/subscriptions/seed', { method: 'POST' }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }, [setServices]);

  useAutoRefresh(loadServices, 60000);

  // Fetch stations (with their embedded services) from /api/stations - for the Stations tab
  // Auto-refresh 60 s + retour sur l'app
  const fetchStations = useCallback(async () => {
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
  }, []);

  useAutoRefresh(fetchStations, 60000);

  // Fetch available washers ("Laveurs disponibles" section on Home)
  // Auto-refresh 30 s + retour sur l'app — un laveur qui passe en ligne
  // apparaît sans recharger l'application.
  const fetchNearbyWashers = useCallback(async () => {
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
  }, [setNearbyWashers]);

  useAutoRefresh(fetchNearbyWashers, 30000);

  // Fetch active promotions — auto-refresh 30 s + retour sur l'app :
  // quand l'admin crée/modifie/désactive une promo, le carousel client
  // se met à jour tout seul, sans recharger la page.
  // Note: Google Places nearby stations feature has been removed
  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions?active=true');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();

      if (data.success && Array.isArray(data.promotions)) {
        // Mise à jour inconditionnelle : une promo supprimée/désactivée
        // doit aussi disparaître du carousel.
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  }, []);

  useAutoRefresh(fetchPromotions, 30000);

  // Sécurité : si la liste rétrécit (promo supprimée), on repart du début
  useEffect(() => {
    if (promotions.length > 0 && currentPromoIndex >= promotions.length) {
      setCurrentPromoIndex(0);
    }
  }, [promotions.length, currentPromoIndex]);

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
    <div className="flex-1 flex flex-col bg-app relative">
      {/* Android Status Bar — aperçu desktop uniquement ; sur téléphone la
          vraie barre système existe déjà, on respecte la safe-area à la place */}
      <div className="h-6 bg-ink hidden md:flex items-center justify-between px-4 flex-shrink-0">
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
        {/* App Bar claire et aérée (masquée sur chat / parcours de réservation) */}
        {activeTab !== 'chat' && activeTab !== 'booking' && (
          <header className="bg-app px-4 pt-4 pb-1 flex items-start justify-between gap-2 flex-shrink-0 max-md:pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="min-w-0">
              {/* Bonjour + position — puces tappable (même fonction : géolocalisation) */}
              <button
                onClick={getUserLocation}
                className="flex items-center gap-1 text-detail text-soft max-w-[250px] active:opacity-70 transition-opacity"
                aria-label={`Position : ${userLocation?.address || 'Lomé'}. Toucher pour actualiser`}
              >
                {isLoadingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 text-brand flex-shrink-0 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                )}
                <span className="truncate">Bonjour · {userLocation?.address || 'Lomé'}</span>
              </button>
              <h1 className="text-title text-ink truncate">{HEADER_TITLES[activeTab] ?? 'Socline'}</h1>
            </div>
            <div className="flex items-center flex-shrink-0">
              <NotificationCenter />
            </div>
          </header>
        )}

        {/* Content - scrollable area */}
        <div className={`flex-1 overflow-y-auto ${activeTab !== 'chat' ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'pb-safe'}`}>
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
            <div className="p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
              <SubscriptionPanel userId={user?.id || ''} walletBalance={walletBalance} />
            </div>
          )}
          {activeTab === 'wallet' && <WalletScreen />}
          {activeTab === 'activity' && <OrderHistory />}
          {activeTab === 'chat' && <ChatList onBack={() => setActiveTab('home')} />}
          {activeTab === 'profile' && <ProfileContent user={user} onLogout={logout} />}
        </div>
      </div>

      {/* Barre de navigation basse — icônes lisibles, onglet actif orange,
          bordure fine au lieu d'une ombre lourde (design system) */}
      {activeTab !== 'chat' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-line flex justify-around items-stretch h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-50">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 transition-all active:scale-95 ${
                  isActive ? 'text-brand' : 'text-soft'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
                <span className="text-micro">{item.label}</span>
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
    <div className="px-4 pt-2 pb-6 space-y-5">
      {/* Recherche — champ blanc discret sur fond gris clair */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-soft pointer-events-none" />
        <Input
          placeholder="Rechercher un service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 bg-surface border-line rounded-btn text-body shadow-card"
        />
      </div>

      {/* Bandeau promo — carte visuelle navy : pastille remise, titre court,
          code à copier, illustration voiture (design system) */}
      {promotions.length > 0 && currentPromo && (
        <div>
          <div
            key={currentPromoIndex}
            className="rounded-card shadow-card animate-fade-in overflow-hidden"
          >
            {(currentPromo.displayType === 'VIDEO' && currentPromo.video) ||
             (currentPromo.displayType === 'IMAGE' && currentPromo.image) ? (
              // Mode média (image ou vidéo) — remise + code + CTA en superposition
              <div className="relative">
                {currentPromo.displayType === 'VIDEO' && currentPromo.video ? (
                  <video
                    src={currentPromo.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-48 object-cover bg-ink"
                  />
                ) : (
                  <img
                    src={currentPromo.image}
                    alt={currentPromo.name}
                    className="w-full h-48 object-cover"
                    style={{ objectPosition: currentPromo.imagePosition || 'center' }}
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between gap-2">
                  <span className="bg-brand text-white text-micro font-bold px-2.5 py-1 rounded-pill">
                    {currentPromo.discountType === 'PERCENTAGE'
                      ? `-${currentPromo.discountValue}%`
                      : `-${currentPromo.discountValue.toLocaleString('fr-FR')}F`}
                  </span>
                  <div className="flex gap-2">
                    {currentPromo.code && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentPromo.code!);
                          toast.success('Code promo copié !');
                        }}
                        className="bg-white/20 backdrop-blur rounded-btn px-2.5 py-1.5 inline-flex items-center gap-1 hover:bg-white/30 transition-colors active:scale-95"
                      >
                        <Copy className="w-3 h-3 text-white" />
                        <span className="text-white text-detail font-semibold">{currentPromo.code}</span>
                      </button>
                    )}
                    <button
                      onClick={onStartOrder}
                      className="bg-white text-ink px-3 py-1.5 rounded-btn text-detail font-bold active:scale-95 transition-transform"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Mode texte — carte navy aérée avec illustration
              <div className="relative bg-gradient-to-br from-ink to-ink-2 p-[18px] min-h-[150px] overflow-hidden text-white">
                <div className="relative z-10">
                  <span className="inline-block bg-brand text-white font-bold text-micro px-2.5 py-1 rounded-pill">
                    {currentPromo.discountType === 'PERCENTAGE'
                      ? `-${currentPromo.discountValue}%`
                      : `-${currentPromo.discountValue.toLocaleString('fr-FR')}F`}
                  </span>
                  <h2 className="text-display mt-2.5 mb-3 max-w-[170px]">{currentPromo.name}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentPromo.code && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentPromo.code!);
                          toast.success('Code promo copié !');
                        }}
                        className="inline-flex items-center gap-2 border border-dashed border-white/45 rounded-btn px-2.5 py-1.5 active:scale-95 transition-transform"
                      >
                        <span className="text-white font-mono text-detail font-bold tracking-wide">{currentPromo.code}</span>
                        <Copy className="w-3.5 h-3.5 text-white/80" />
                      </button>
                    )}
                    <button
                      onClick={onStartOrder}
                      className="bg-white text-ink rounded-btn px-3 py-1.5 text-detail font-bold active:scale-95 transition-transform"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
                <img
                  src="/voitures/voiture-transparente.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute -right-5 -bottom-1 w-[160px]"
                />
              </div>
            )}
          </div>

          {/* Points du carrousel — pastille allongée pour l'actif */}
          {promotions.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2.5">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPromoIndex(index)}
                  aria-label={`Promotion ${index + 1}`}
                  className={`h-1.5 rounded-pill transition-all duration-300 ${
                    index === currentPromoIndex
                      ? 'w-[18px] bg-brand'
                      : 'w-1.5 bg-line'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Choix Indépendants / Stations — sélecteur segmenté */}
      <section>
        <Segmented
          options={[
            { value: 'independent', label: 'Indépendants', icon: <User className="w-[18px] h-[18px]" /> },
            { value: 'station', label: 'Stations', icon: <Building className="w-[18px] h-[18px]" /> },
          ]}
          value={serviceTab}
          onChange={setServiceTab}
        />

        {/* Formules des laveurs indépendants — service à domicile (le laveur
            se déplace chez vous) : cartes illustrées, icônes à la place du texte */}
        {serviceTab === 'independent' && (
          <>
            <div className="mt-4">
              <SectionHeader title="Nos formules" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {services.length === 0 ? (
                <div className="col-span-2 lg:col-span-4">
                  <EmptyState icon={Car} message="Aucune formule disponible pour le moment" />
                </div>
              ) : (
                services.map((service, index) => (
                  <ServiceArtCard
                    key={service.id}
                    service={service}
                    index={index}
                    onClick={() => setSelectedService(service)}
                  />
                ))
              )}
            </div>
          </>
        )}
        
        {/* Stations — le client se rend à la station */}
        {serviceTab === 'station' && (
          <>
            <div className="mt-4">
              <SectionHeader title="Stations" />
            </div>
            {appStations.length === 0 ? (
              <EmptyState icon={Building} message="Aucune station disponible pour le moment" />
            ) : (
              <div className="space-y-2.5">
                {appStations.map((station) => {
                  const image = getStationImage(station);
                  const serviceCount = Array.isArray(station.services) ? station.services.length : 0;
                  return (
                    <button
                      key={station.id}
                      onClick={() => setSelectedStation(station)}
                      className="w-full bg-surface rounded-card border border-line shadow-card p-3 flex gap-3 items-center active:scale-[0.99] transition-transform text-left"
                    >
                      {image ? (
                        <img src={image} alt={station.name} className="w-16 h-16 rounded-btn object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-brand-soft rounded-btn flex items-center justify-center flex-shrink-0">
                          <Building className="w-7 h-7 text-brand" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-semibold text-ink truncate">{station.name}</p>
                        <p className="text-detail text-soft truncate">{station.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {station.rating > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-star fill-star" />
                              <span className="text-detail text-soft">{station.rating.toFixed(1)}</span>
                            </div>
                          )}
                          {serviceCount > 0 && (
                            <span className="text-detail text-soft">{serviceCount} service{serviceCount > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-soft flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Service Details Modal */}
      <Dialog open={!!selectedService} onOpenChange={(next) => { if (!next) setSelectedService(null); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left text-lg font-bold text-[#212121]">
                  {selectedService.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Service Icon, Category & Coverage */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                    <ServiceIcon service={selectedService} className="w-7 h-7 text-[#FF9800]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-[#FFF3E0] text-[#FF9800] capitalize">
                        {selectedService.category}
                      </Badge>
                      <CoverageBadge service={selectedService} />
                    </div>
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
                  <span className="text-xl font-bold text-[#FF9800]">{formatPrice(selectedService.price)}</span>
                </div>

                {/* What the wash includes — exterior vs interior */}
                <CoverageDetails service={selectedService} />

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
      <Dialog open={!!selectedStation} onOpenChange={(next) => { if (!next) setSelectedStation(null); }}>
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
                              <ServiceIcon service={service} className="w-5 h-5 text-[#FF9800]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium text-[#212121] text-sm">{service.name}</p>
                                <CoverageBadge service={service} short />
                              </div>
                              {service.description && (
                                <p className="text-xs text-[#757575] mt-0.5 line-clamp-2">{service.description}</p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-[#757575] flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {service.duration} min
                                </span>
                                <span className="text-sm font-bold text-[#FF9800]">{formatPrice(service.price)}</span>
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

      {/* Laveurs disponibles — rangées : avatar, note, statut en ligne, un bouton clair */}
      <section>
        <SectionHeader
          title="Laveurs disponibles"
          action={!washersLoading && availableWashers.length > 4 ? (showAllWashers ? 'Réduire' : 'Voir tout') : undefined}
          onAction={() => setShowAllWashers(!showAllWashers)}
        />
        {washersLoading ? (
          /* Skeleton loaders (design system) */
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[290px] bg-surface rounded-card border border-line p-3 flex items-center gap-3 animate-pulse">
                <div className="w-[54px] h-[54px] rounded-[18px] bg-line" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-line rounded-pill w-24" />
                  <div className="h-3 bg-line rounded-pill w-32" />
                </div>
                <div className="h-9 w-[76px] bg-line rounded-btn" />
              </div>
            ))}
          </div>
        ) : availableWashers.length === 0 ? (
          <EmptyState icon={User} message="Aucun laveur en ligne pour le moment" />
        ) : showAllWashers ? (
          <div className="space-y-2.5">
            {availableWashers.map((washer) => (
              <WasherRow
                key={washer.id}
                name={washer.user?.name || 'Laveur'}
                rating={washer.rating ?? 0}
                jobs={washer.completedJobs ?? 0}
                avatar={washer.user?.avatar ?? null}
                onAction={onStartOrder}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {availableWashers.map((washer) => (
              <div key={washer.id} className="flex-shrink-0 w-[290px]">
                <WasherRow
                  name={washer.user?.name || 'Laveur'}
                  rating={washer.rating ?? 0}
                  jobs={washer.completedJobs ?? 0}
                  avatar={washer.user?.avatar ?? null}
                  onAction={onStartOrder}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Carrousel média (images + vidéos) — juste après « Laveurs disponibles » */}
      <MediaCarousel onReserve={onStartOrder} />
    </div>
  );
}

// Profil Content — design system (cartes blanches, accents orange)
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
    <div className="p-4 space-y-4 pb-16 bg-app min-h-full">
      {/* Carte profil : avatar dégradé orange + édition */}
      <div className={`p-3.5 ${CARD_CLASSES}`}>
        <div className="flex items-center gap-3.5">
          <div className="w-[58px] h-[58px] rounded-[19px] bg-gradient-to-br from-brand to-brand-light grid place-items-center text-white text-title font-extrabold flex-shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body font-bold text-ink truncate">{user?.name || 'Utilisateur'}</p>
            <p className="text-detail text-soft">+228 {user?.phone || '90 12 34 56'}</p>
          </div>
          <button
            onClick={() => setActiveSection('settings')}
            aria-label="Modifier mon profil"
            className="w-9 h-9 rounded-[11px] bg-surface border border-line grid place-items-center flex-shrink-0 active:scale-95 transition-transform"
          >
            <Pencil className="w-[17px] h-[17px] text-brand" />
          </button>
        </div>
      </div>

      {/* Véhicules — gestionnaire multi-cartes (inchangé) */}
      <CarsManager userId={user?.id} />

      {/* Statistiques : 3 cartes teintées */}
      <div>
        <h3 className="text-section text-ink mb-2.5">Statistiques</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <div className={`p-3.5 text-center ${CARD_CLASSES}`}>
            <div className="w-9 h-9 rounded-[12px] bg-plan-blue grid place-items-center mx-auto mb-2">
              <Droplets className="w-5 h-5 text-plan-blue-icon" strokeWidth={2} />
            </div>
            <p className="text-[17px] font-bold text-ink leading-none">
              {profileStats ? profileStats.washes : <Loader2 className="w-4 h-4 animate-spin mx-auto text-brand" />}
            </p>
            <p className="text-micro text-soft mt-1.5">Lavages</p>
          </div>
          <div className={`p-3.5 text-center ${CARD_CLASSES}`}>
            <div className="w-9 h-9 rounded-[12px] bg-star-soft grid place-items-center mx-auto mb-2">
              <Star className="w-5 h-5 text-star" strokeWidth={2} />
            </div>
            <p className="text-[17px] font-bold text-ink leading-none">–</p>
            <p className="text-micro text-soft mt-1.5">Note</p>
          </div>
          <div className={`p-3.5 text-center ${CARD_CLASSES}`}>
            <div className="w-9 h-9 rounded-[12px] bg-plan-green grid place-items-center mx-auto mb-2">
              <Wallet className="w-5 h-5 text-plan-green-icon" strokeWidth={2} />
            </div>
            <p className="text-[17px] font-bold text-ink leading-none">
              {profileStats ? `${profileStats.spent.toLocaleString('fr-FR')} F` : <Loader2 className="w-4 h-4 animate-spin mx-auto text-brand" />}
            </p>
            <p className="text-micro text-soft mt-1.5">Dépensé</p>
          </div>
        </div>
      </div>

      {/* Bloc support navy : Appeler + WhatsApp */}
      <div className="bg-gradient-to-br from-ink to-ink-2 rounded-card p-4 text-white">
        <div className="flex items-center gap-3 mb-3.5">
          <div className="w-[42px] h-[42px] rounded-[14px] bg-white/10 grid place-items-center flex-shrink-0">
            <Headphones className="w-[22px] h-[22px] text-white" />
          </div>
          <div>
            <p className="text-body font-bold">Besoin d'aide ?</p>
            <p className="text-detail text-white/60">Une réponse rapide, 7j/7</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleCallSupport}
            className="bg-white text-ink rounded-btn py-2.5 px-3 flex items-center justify-center gap-2 text-detail font-bold min-h-[44px] active:scale-95 transition-transform"
          >
            <Phone className="w-[17px] h-[17px]" />
            Appeler
          </button>
          <button
            onClick={handleWhatsAppSupport}
            className="bg-[#25D366] text-white rounded-btn py-2.5 px-3 flex items-center justify-center gap-2 text-detail font-bold min-h-[44px] active:scale-95 transition-transform"
          >
            <MessageSquare className="w-[17px] h-[17px]" />
            WhatsApp
          </button>
        </div>
      </div>

      {/* Menu : historique / adresses / paramètres */}
      <div className={`${CARD_CLASSES} overflow-hidden`}>
        {[
          { icon: Clock, label: 'Historique', section: 'history', description: 'Toutes vos activités' },
          { icon: MapPin, label: 'Adresses', section: 'addresses', description: 'Gérez vos adresses' },
          { icon: Settings, label: 'Paramètres', section: 'settings', description: 'Modifiez votre compte' },
        ].map((item, index) => (
          <button
            key={index}
            onClick={() => setActiveSection(item.section)}
            className="w-full flex items-center gap-3 p-3.5 active:bg-app transition-colors border-b border-line last:border-0"
          >
            <div className="w-10 h-10 bg-brand-soft rounded-[13px] grid place-items-center flex-shrink-0">
              <item.icon className="w-5 h-5 text-brand" strokeWidth={2} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="text-ink text-body font-semibold">{item.label}</span>
              <p className="text-micro text-soft">{item.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-soft/60 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Déconnexion */}
      <button
        onClick={onLogout}
        className="w-full h-12 border border-line bg-surface text-danger rounded-btn font-semibold text-body active:bg-danger/5 transition-colors min-h-[44px]"
      >
        <LogOut className="w-4 h-4 inline mr-2" />
        Déconnexion
      </button>
    </div>
  );
}
