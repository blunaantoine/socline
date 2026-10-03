'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, useOrdersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Power, MapPin, Clock, Star, DollarSign, CheckCircle, 
  Navigation, Phone, MessageCircle, Car, AlertCircle,
  Wallet, TrendingUp, Calendar, LogOut, Settings, Home,
  RefreshCw, Loader2, ArrowLeft, Crown, Edit, Bell, Banknote
} from 'lucide-react';
import { HideableBalanceDark, HideableBalanceLight } from '@/components/ui/hideable-balance';
import type { Order, OrderStatus, Conversation, User, Washer as WasherType } from '@/types';
import type { Socket } from 'socket.io-client';
import { ChatView } from '@/components/chat/ChatView';
import { toast } from 'sonner';
import { parseJsonResponse } from '@/lib/json-helper';
import { StationDashboard } from '@/components/washer/StationDashboard';
import { onSoclineNotification } from '@/components/RealtimeNotifications';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';
import { isRealtimeEnabled } from '@/lib/realtime-flag';

// Washer stats type
interface WasherStats {
  name: string;
  rating: number;
  totalRatings: number;
  completedJobs: number;
  totalEarnings: number;
  todayEarnings: number;
  todayJobs: number;
  balance: number;
}

export function WasherApp() {
  const { user, logout } = useAuthStore();
  const { currentOrder, setCurrentOrder, orders, setOrders } = useOrdersStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [washerData, setWasherData] = useState<WasherType | null>(null);
  const [partnerLevel, setPartnerLevel] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [profileSection, setProfileSection] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Availability sync: the DB value wins on FIRST load only — afterwards the
  // toggle is optimistic and persisted immediately (PATCH /api/washers/:id).
  // (handleToggleAvailability is defined below, after fetchPendingOrders.)
  const availabilitySyncedRef = useRef(false);

  // Fetch conversation for current order
  const fetchConversation = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/conversations?orderId=${orderId}`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success && data.conversation) {
        setConversation(data.conversation);
      }
    } catch (error) {
      console.error('Fetch conversation error:', error);
    }
  }, []);

  // Open chat for order
  const handleOpenChat = useCallback(async (order: Order) => {
    if (order.id) {
      await fetchConversation(order.id);
      setShowChat(true);
    }
  }, [fetchConversation]);

  // Fetch washer data (stats, balance, washerType, station)
  const fetchWasherData = useCallback(async () => {
    if (!user) return;

    setIsRefreshingBalance(true);
    try {
      const res = await fetch(`/api/washers/${user.id}`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success && data.washer) {
        setWasherData(data.washer as WasherType);
        // Contrat de Partenariat, Article 5: progressive partner level
        setPartnerLevel(data.partnerLevel || null);
        // First load: adopt the PERSISTED availability (source of truth).
        if (!availabilitySyncedRef.current && typeof data.washer.isAvailable === 'boolean') {
          availabilitySyncedRef.current = true;
          setIsAvailable(data.washer.isAvailable);
        }
      }
    } catch (error) {
      console.error('Fetch washer data error:', error);
    } finally {
      setIsRefreshingBalance(false);
      setIsInitialLoading(false);
    }
  }, [user]);

  // Get washer stats from washerData or defaults
  const washerStats = {
    name: user?.name || 'Laveur',
    rating: washerData?.rating || 0,
    totalRatings: washerData?.totalRatings || 0,
    completedJobs: washerData?.completedJobs || 0,
    totalEarnings: washerData?.totalEarnings || 0,
    todayEarnings: washerData?.todayEarnings || 0,
    todayJobs: washerData?.todayJobs || 0,
    balance: washerData?.totalEarnings || 0,
  };

  // Fetch pending orders
  const fetchPendingOrders = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?userId=${user.id}&role=WASHER&status=PENDING`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setPendingOrders(data.orders);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ---------------------------------------------------------------------
  // Persist the availability toggle. Optimistic update; reverted on failure.
  // When going ONLINE, attach the device's last known GPS position
  // (best-effort) so the job pool can be sorted by proximity.
  // ---------------------------------------------------------------------
  const handleToggleAvailability = useCallback(async (checked: boolean) => {
    if (!user) return;
    const previous = isAvailable;
    setIsAvailable(checked);
    // Going offline → drop the stale shared pool view.
    if (!checked) setPendingOrders([]);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (checked && typeof navigator !== 'undefined' && navigator.geolocation) {
        // Best-effort single GPS fix (≤ 5s). Failure never blocks the toggle.
        const coords = await new Promise<GeolocationCoordinates | undefined>((resolve) => {
          const timer = setTimeout(() => resolve(undefined), 5000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timer);
              resolve(pos?.coords);
            },
            () => {
              clearTimeout(timer);
              resolve(undefined);
            },
            { timeout: 4500, maximumAge: 60000, enableHighAccuracy: false }
          );
        });
        latitude = coords?.latitude;
        longitude = coords?.longitude;
      }

      const res = await fetch(`/api/washers/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAvailable: checked,
          ...(latitude !== undefined && longitude !== undefined
            ? { latitude, longitude }
            : {}),
        }),
      });
      const data = await parseJsonResponse<any>(res);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Erreur');
      }
      toast.success(checked ? 'Vous êtes en ligne' : 'Vous êtes hors ligne');
      if (checked) fetchPendingOrders();
    } catch (error) {
      console.error('Toggle availability error:', error);
      setIsAvailable(previous);
      toast.error('Impossible de changer votre disponibilité. Réessayez.');
    }
  }, [user, isAvailable, fetchPendingOrders]);

  // Fetch my orders (active and history)
  const fetchMyOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const res = await fetch(`/api/orders?userId=${user.id}&role=WASHER`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setOrders(data.orders);
        
        // Set current active order
        const active = data.orders.find((o: Order) => 
          ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)
        );
        if (active) {
          setCurrentOrder(active);
        }
      }
    } catch (error) {
      console.error('Fetch my orders error:', error);
    }
  }, [user, setOrders, setCurrentOrder]);

  // Initial load and polling
  useEffect(() => {
    fetchPendingOrders();
    fetchMyOrders();
    fetchWasherData();
    
    // Poll for new orders every 10 seconds when available
    const interval = setInterval(() => {
      if (isAvailable) {
        fetchPendingOrders();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isAvailable, fetchPendingOrders, fetchMyOrders, fetchWasherData]);

  // ---------------------------------------------------------------------
  // Realtime job list refresh: authenticated socket on the mini-service.
  // The API emits 'order:updated' on every validated status transition —
  // the washer app re-fetches its pending + assigned orders lists.
  // ---------------------------------------------------------------------
  const refreshListsRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshListsRef.current = () => {
      fetchPendingOrders();
      fetchMyOrders();
    };
  }, [fetchPendingOrders, fetchMyOrders]);

  useEffect(() => {
    let cancelled = false;

    const initSocket = async () => {
      // Serverless demo (Vercel): realtime disabled, polling fallbacks only.
      if (!isRealtimeEnabled()) return;

      const token = useAuthStore.getState().token;
      if (!token) {
        console.warn('[WasherApp] No auth token — realtime refresh disabled');
        return;
      }

      const { io } = await import('socket.io-client');
      if (cancelled) return;

      const socket = io('/?XTransformPort=3003', {
        transports: ['websocket'],
        reconnection: true,
        auth: { token },
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (cancelled) return;
        // Register in the personal user room (identity enforced from the JWT).
        socket.emit('join');
      });

      socket.on('order:updated', () => {
        if (cancelled) return;
        refreshListsRef.current();
      });

      // A client just created an order → refresh the shared job pool at once
      // (no need to wait for the 10s poll).
      socket.on('order:new', () => {
        if (cancelled) return;
        refreshListsRef.current();
      });
    };

    initSocket();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------
  // Live GPS sharing: while the washer has an assigned order EN_ROUTE or
  // ARRIVED, stream the device position to /api/orders/[id]/location
  // (throttled to at most 1 push / 10 s, immediate first fix).
  // ---------------------------------------------------------------------
  const lastLocationSentRef = useRef(0);
  const [locationSharing, setLocationSharing] = useState(false);

  useEffect(() => {
    const orderId = currentOrder?.id;
    const status = currentOrder?.status;
    const shouldShare = !!orderId && (status === 'EN_ROUTE' || status === 'ARRIVED');

    if (!shouldShare || typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationSharing(false);
      if (shouldShare) {
        console.warn('[WasherApp] Geolocation unavailable — position sharing disabled');
      }
      return;
    }

    let watchId: number | null = null;
    let stopped = false;
    let failures = 0;

    const stopSharing = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      setLocationSharing(false);
    };

    const postLocation = async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        failures = 0;
      } catch (error) {
        // Silent (no toast spam): only warn in the console.
        failures += 1;
        console.warn('[WasherApp] Location push failed:', error);
        if (failures >= 3) stopSharing();
      }
    };

    const sendIfDue = (latitude: number, longitude: number, force = false) => {
      if (stopped) return;
      const now = Date.now();
      if (!force && now - lastLocationSentRef.current < 10000) return;
      lastLocationSentRef.current = now;
      postLocation(latitude, longitude);
    };

    const onGeoError = (error: GeolocationPositionError) => {
      if (stopped) return;
      failures += 1;
      console.warn('[WasherApp] Geolocation error:', error.message);
      if (failures >= 3) stopSharing();
    };

    setLocationSharing(true);
    watchId = navigator.geolocation.watchPosition(
      (position) => sendIfDue(position.coords.latitude, position.coords.longitude),
      onGeoError,
      { enableHighAccuracy: true }
    );

    // Send one fix immediately when sharing starts (bypasses the throttle).
    navigator.geolocation.getCurrentPosition(
      (position) => sendIfDue(position.coords.latitude, position.coords.longitude, true),
      (error) => console.warn('[WasherApp] Initial geolocation error:', error.message),
      { enableHighAccuracy: true }
    );

    return () => {
      stopped = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [currentOrder?.id, currentOrder?.status]);

  // Accept order
  const handleAcceptOrder = async (order: Order) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: 'ACCEPTED',
          washerId: user?.id,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setCurrentOrder(data.order);
        setPendingOrders(prev => prev.filter(o => o.id !== order.id));
        setActiveTab('active');
      } else {
        // e.g. offline washer (403) or order grabbed by another washer first.
        toast.error(data.error || 'Impossible d\'accepter la commande');
        fetchPendingOrders();
      }
    } catch (error) {
      console.error('Accept order error:', error);
      toast.error('Erreur réseau — commande non acceptée');
    }
  };

  // Update order status
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!currentOrder) return;
    
    try {
      // If this is a subscription order and completing, validate subscription first
      if (currentOrder.isSubscriptionOrder && newStatus === 'COMPLETED') {
        const res = await fetch('/api/subscriptions/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: currentOrder.id,
            washerId: user?.id,
            action: 'VALIDATE',
          }),
        });

        const data = await parseJsonResponse<any>(res);
        if (!data) return;

        if (data.success) {
          setCurrentOrder(null);
          fetchMyOrders();
          return;
        }
      }

      // Regular status update
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder.id,
          status: newStatus,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setCurrentOrder(data.order);
        if (newStatus === 'COMPLETED') {
          setCurrentOrder(null);
          fetchMyOrders();
        }
      }
    } catch (error) {
      console.error('Update order error:', error);
    }
  };

  // If this washer is a STATION_OWNER, render the dedicated station dashboard
  // instead of the independent washer interface.
  if (washerData?.washerType === 'STATION_OWNER') {
    return (
      <StationDashboard
        washer={washerData}
        user={user}
        onLogout={logout}
      />
    );
  }

  // While we are still determining the washer type (initial load), show a
  // full-screen spinner so the user doesn't see the independent washer UI flash
  // before we route them to the station dashboard.
  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFAFA] min-h-screen">
        <Loader2 className="w-10 h-10 text-[#FF9800] animate-spin mb-3" />
        <p className="text-sm text-[#757575]">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] overflow-hidden">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#4CAF50] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
        <span className="text-white text-xs font-medium">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex items-center gap-1">
          {/* Signal Network Bars */}
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

      {/* Header with Availability */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0 sticky top-6 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-xl font-bold">
              {washerStats.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-[#212121]">{washerStats.name}</div>
              <div className="flex items-center gap-1">
                {washerStats.rating > 0 ? (
                  <>
                    <Star className="w-4 h-4 text-[#FFC107] fill-[#FFC107]" />
                    <span className="text-sm text-[#757575]">{washerStats.rating.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-sm text-[#9E9E9E]">Nouveau laveur</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-[#757575]">Disponibilité</div>
              <div className={`text-sm font-medium ${isAvailable ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'}`}>
                {isAvailable ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={handleToggleAvailability}
              className={isAvailable ? 'bg-[#4CAF50]' : ''}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16">
        {activeTab === 'dashboard' && (
          <WasherDashboard 
            stats={washerStats} 
            isAvailable={isAvailable} 
            isLoading={isLoading}
            pendingOrders={pendingOrders}
            onAccept={handleAcceptOrder}
            onRefresh={fetchPendingOrders}
            onRefreshBalance={fetchWasherData}
            isRefreshingBalance={isRefreshingBalance}
            partnerLevel={partnerLevel}
            acceptedOrders={orders.filter(o => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(o.status))}
          />
        )}
        {activeTab === 'active' && (
          <ActiveOrderView 
            order={currentOrder} 
            onUpdateStatus={handleUpdateStatus} 
            onBack={() => setActiveTab('dashboard')}
            onOpenChat={handleOpenChat}
            acceptedOrders={orders.filter(o => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(o.status))}
            onSelectOrder={setCurrentOrder}
            locationSharing={locationSharing}
          />
        )}
        {activeTab === 'history' && (
          <WasherOrderHistory 
            orders={orders} 
            onBack={() => setActiveTab('dashboard')} 
          />
        )}
        {activeTab === 'earnings' && (
          <WasherEarnings 
            stats={washerStats} 
            onBack={() => setActiveTab('dashboard')}
            onRefreshBalance={fetchWasherData}
            isRefreshingBalance={isRefreshingBalance}
            washerId={user?.id || ''}
          />
        )}
        {activeTab === 'profile' && (
          profileSection ? (
            <WasherProfileSection 
              section={profileSection} 
              onBack={() => setProfileSection(null)}
              user={user}
            />
          ) : (
            <WasherProfile 
              user={user} 
              stats={washerStats} 
              onLogout={logout} 
              onBack={() => setActiveTab('dashboard')}
              onNavigate={setProfileSection}
            />
          )
        )}
      </div>

      {/* Android Bottom Navigation - FIXED at bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-center h-14 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        {[
          { id: 'dashboard', icon: Home, label: 'Accueil' },
          { id: 'active', icon: Car, label: 'Active' },
          { id: 'history', icon: Clock, label: 'Historique' },
          { id: 'earnings', icon: Wallet, label: 'Revenus' },
          { id: 'profile', icon: Settings, label: 'Profil' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-4 transition-all ${
                isActive ? 'text-[#4CAF50]' : 'text-[#757575]'
              }`}
            >
              <tab.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Chat Overlay */}
      {showChat && conversation && (
        <div className="absolute inset-0 z-[60] bg-[#FAFAFA]">
          <ChatView 
            conversation={conversation} 
            onBack={() => setShowChat(false)} 
          />
        </div>
      )}
    </div>
  );
}

// Washer Dashboard
function WasherDashboard({ stats, isAvailable, isLoading, pendingOrders, onAccept, onRefresh, onRefreshBalance, isRefreshingBalance, partnerLevel, acceptedOrders }: { 
  stats: WasherStats; 
  isAvailable: boolean;
  isLoading: boolean;
  pendingOrders: Order[];
  onAccept: (order: Order) => void;
  onRefresh: () => void;
  onRefreshBalance: () => void;
  isRefreshingBalance: boolean;
  partnerLevel: any;
  acceptedOrders: Order[];
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Status Banner */}
      {!isAvailable && (
        <div className="bg-[#FFF3E0] border border-[#FFCC80] rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#FF9800]" />
          <div>
            <p className="font-medium text-[#E65100]">Vous êtes hors ligne</p>
            <p className="text-sm text-[#EF6C00]">
              Activez votre disponibilité pour recevoir des commandes.
            </p>
          </div>
        </div>
      )}

      {/* Partner Level Banner (Contrat Article 5 — rémunération progressive) */}
      {partnerLevel && (
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                  <Crown className="w-5 h-5 text-[#2E7D32]" />
                </div>
                <div>
                  <p className="font-semibold text-[#212121] text-sm">
                    Niveau {partnerLevel.level} – {partnerLevel.name}
                  </p>
                  <p className="text-xs text-[#757575]">
                    Votre part : <span className="font-bold text-[#4CAF50]">{partnerLevel.share} %</span> par prestation
                  </p>
                </div>
              </div>
              {partnerLevel.nextLevel && (
                <div className="text-right">
                  <p className="text-[10px] text-[#9E9E9E] uppercase tracking-wide">Suivant</p>
                  <p className="text-xs font-semibold text-[#E65100]">
                    Niv. {partnerLevel.nextLevel.level} · {partnerLevel.nextLevel.share} %
                  </p>
                </div>
              )}
            </div>
            {partnerLevel.nextLevel ? (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[#757575] mb-1">
                  <span>{partnerLevel.stats?.completedJobs ?? 0} / {partnerLevel.nextLevel.minJobs} prestations</span>
                  <span>Note ≥ {partnerLevel.nextLevel.minRating.toLocaleString('fr-FR')} / 5</span>
                </div>
                <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((partnerLevel.stats?.completedJobs ?? 0) / Math.max(1, partnerLevel.nextLevel.minJobs)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-[#9E9E9E] mt-1.5">
                  {partnerLevel.nextLevel.description}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-[#4CAF50] mt-2 font-medium">
                🏆 Niveau maximum atteint — Bravo pour votre excellence !
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Balance Card with Refresh */}
      <Card className="bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] text-white border-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Solde disponible</p>
              <HideableBalanceDark
                balance={stats.balance}
                currency="XOF"
                size="lg"
                storageKey="hide-washer-balance"
              />
            </div>
            <button 
              onClick={onRefreshBalance}
              disabled={isRefreshingBalance}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              {isRefreshingBalance ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Aujourd&apos;hui</p>
                <HideableBalanceLight
                  balance={stats.todayEarnings}
                  currency="XOF"
                  size="md"
                  storageKey="hide-washer-today-earnings"
                  balanceClassName="text-[#4CAF50]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center">
                <Car className="w-5 h-5 text-[#2196F3]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Lavages</p>
                <p className="text-lg font-bold text-[#2196F3]">{stats.todayJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accepted Orders - Active tracking */}
      {acceptedOrders.length > 0 && (
        <div>
          <h2 className="font-semibold text-[#212121] mb-3">Commandes en cours ({acceptedOrders.length})</h2>
          <div className="space-y-3">
            {acceptedOrders.map((order) => (
              <Card key={order.id} className="border-0 shadow-sm border-l-4 border-l-[#4CAF50]">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-[#212121]">{order.client?.name || 'Client'}</p>
                      <p className="text-sm text-[#757575]">{order.service?.name || 'Service'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'EN_ROUTE' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'ARRIVED' ? 'bg-purple-100 text-purple-800' :
                          order.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status === 'ACCEPTED' && 'Acceptée'}
                          {order.status === 'EN_ROUTE' && 'En route'}
                          {order.status === 'ARRIVED' && 'Arrivé'}
                          {order.status === 'IN_PROGRESS' && 'En cours'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#4CAF50]">{order.totalPrice?.toLocaleString()} XOF</p>
                      <p className="text-xs text-[#757575]">{order.address?.substring(0, 20)}...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#212121]">Commandes en attente</h2>
          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className="text-[#FF9800] text-sm flex items-center gap-1"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>

        {isAvailable ? (
          pendingOrders.length > 0 ? (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm opacity-80">Nouvelle commande</p>
                          <p className="font-bold text-lg">{order.service?.name || 'Service'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xl">{order.totalPrice?.toLocaleString()} XOF</p>
                          <p className="text-sm opacity-80">{order.service?.duration || 30} min</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#FF9800]" />
                        <span className="text-sm text-[#212121]">{order.address || 'Adresse non spécifiée'}</span>
                        {typeof order.distanceKm === 'number' && (
                          <span className="ml-auto shrink-0 text-xs font-semibold text-[#FF9800] bg-[#FFF3E0] px-2 py-0.5 rounded-full">
                            {order.distanceKm} km
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#757575]">Client: {order.client?.name || 'N/A'}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-[#4CAF50] hover:bg-[#43A047] rounded-xl"
                          onClick={() => onAccept(order)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accepter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              {isLoading ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin mx-auto mb-3" />
                  <p className="text-[#757575]">Recherche de commandes...</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-[#4CAF50]" />
                  </div>
                  <p className="font-semibold text-[#212121]">En attente de commandes</p>
                  <p className="text-sm text-[#757575] mt-1">
                    Vous serez notifié dès qu&apos;une commande arrive.
                  </p>
                </>
              )}
            </div>
          )
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
              <Power className="w-8 h-8 text-[#9E9E9E]" />
            </div>
            <p className="font-medium text-[#757575]">Vous êtes hors ligne</p>
            <p className="text-sm text-[#9E9E9E] mt-1">
              Activez votre disponibilité pour recevoir des commandes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Active Order View
function ActiveOrderView({ order, onUpdateStatus, onBack, onOpenChat, acceptedOrders, onSelectOrder, locationSharing }: { 
  order: Order | null; 
  onUpdateStatus: (status: OrderStatus) => void;
  onBack: () => void;
  onOpenChat: (order: Order) => void;
  acceptedOrders: Order[];
  onSelectOrder: (order: Order | null) => void;
  locationSharing?: boolean;
}) {

  const steps = [
    { status: 'ACCEPTED', label: 'Acceptée', icon: CheckCircle },
    { status: 'EN_ROUTE', label: 'En route', icon: Navigation },
    { status: 'ARRIVED', label: 'Arrivé', icon: MapPin },
    { status: 'IN_PROGRESS', label: 'En cours', icon: Car },
    { status: 'COMPLETED', label: 'Terminée', icon: CheckCircle },
  ];

  // If no specific order selected, show list of accepted orders
  if (!order) {
    return (
      <div className="p-4 space-y-4">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#4CAF50]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </button>
        
        <h2 className="font-semibold text-lg text-[#212121]">Commandes actives</h2>
        
        {acceptedOrders.length > 0 ? (
          <div className="space-y-3">
            {acceptedOrders.map((o) => (
              <Card 
                key={o.id} 
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSelectOrder(o)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-[#212121]">{o.client?.name || 'Client'}</p>
                      <p className="text-sm text-[#757575]">{o.service?.name || 'Service'}</p>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                        o.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                        o.status === 'EN_ROUTE' ? 'bg-yellow-100 text-yellow-800' :
                        o.status === 'ARRIVED' ? 'bg-purple-100 text-purple-800' :
                        o.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {o.status === 'ACCEPTED' && 'Acceptée'}
                        {o.status === 'EN_ROUTE' && 'En route'}
                        {o.status === 'ARRIVED' && 'Arrivé'}
                        {o.status === 'IN_PROGRESS' && 'En cours'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#4CAF50]">{o.totalPrice?.toLocaleString()} XOF</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-8 h-8 text-[#9E9E9E]" />
            </div>
            <p className="font-medium text-[#757575]">Aucune commande active</p>
            <p className="text-sm text-[#9E9E9E] mt-1">
              Les nouvelles commandes apparaîtront ici.
            </p>
          </div>
        )}
      </div>
    );
  }

  const currentStepIndex = steps.findIndex(s => s.status === order.status);

  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[#4CAF50]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </button>

      {/* Progress Steps - Android Stepper Style */}
      <div className="bg-white px-4 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isPast = index < currentStepIndex;
            const Icon = step.icon;
            
            return (
              <div key={step.status} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-[#4CAF50] text-white shadow-lg shadow-[#4CAF50]/30'
                        : isPast
                        ? 'bg-[#4CAF50] text-white'
                        : 'bg-[#E0E0E0] text-[#9E9E9E]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] mt-0.5 font-medium whitespace-nowrap ${
                    isActive ? 'text-[#4CAF50] font-bold' : isPast ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${
                    isPast ? 'bg-[#4CAF50]' : 'bg-[#E0E0E0]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-[#E3F2FD] text-[#2196F3]">
                {order.client?.name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-[#212121]">{order.client?.name || 'Client'}</h3>
              <p className="text-sm text-[#757575]">{order.client?.phone || ''}</p>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" className="rounded-full">
                <Phone className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                className="rounded-full bg-[#4CAF50] text-white hover:bg-[#43A047]"
                onClick={() => order && onOpenChat(order)}
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service & Location */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs text-[#757575]">Service</p>
            <p className="font-medium text-[#212121]">{order.service?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#757575]">Adresse</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF9800]" />
              <p className="font-medium text-[#212121]">{order.address || 'N/A'}</p>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#F5F5F5]">
            <span className="text-[#757575]">Vos gains</span>
            <span className="font-bold text-[#4CAF50]">
              {((order.totalPrice || 0) - (order.commission || 0)).toLocaleString()} XOF
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Live GPS sharing indicator */}
      {locationSharing && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4CAF50] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4CAF50]"></span>
          </span>
          <span className="text-xs font-medium text-[#2E7D32]">Position partagée</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {order.status === 'ACCEPTED' && (
          <Button
            className="w-full h-12 bg-[#2196F3] hover:bg-[#1976D2] rounded-xl"
            onClick={() => onUpdateStatus('EN_ROUTE')}
          >
            <Navigation className="w-5 h-5 mr-2" />
            Démarrer le trajet
          </Button>
        )}

        {order.status === 'EN_ROUTE' && (
          <Button
            className="w-full h-12 bg-[#4CAF50] hover:bg-[#43A047] rounded-xl"
            onClick={() => onUpdateStatus('ARRIVED')}
          >
            <MapPin className="w-5 h-5 mr-2" />
            Je suis arrivé
          </Button>
        )}

        {order.status === 'ARRIVED' && (
          <Button
            className="w-full h-12 bg-[#9C27B0] hover:bg-[#8E24AA] rounded-xl"
            onClick={() => onUpdateStatus('IN_PROGRESS')}
          >
            <Car className="w-5 h-5 mr-2" />
            Commencer le lavage
          </Button>
        )}

        {order.status === 'IN_PROGRESS' && order.isSubscriptionOrder && !order.subscriptionValidated && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2">
            <p className="text-sm text-purple-800 font-medium">
              ⚠️ Cette commande utilise un abonnement
            </p>
            <p className="text-xs text-purple-600">
              Le client a une séance. Veuillez valider cette séance pour terminer le lavage.
            </p>
          </div>
        )}

        {order.status === 'IN_PROGRESS' && (
          <Button
            className="w-full h-12 bg-[#4CAF50] hover:bg-[#43A047] rounded-xl"
            onClick={() => onUpdateStatus('COMPLETED')}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Terminer le lavage
          </Button>
        )}
      </div>
    </div>
  );
}

// Washer Order History
function WasherOrderHistory({ orders, onBack }: { 
  orders: Order[];
  onBack: () => void;
}) {
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  
  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[#4CAF50]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </button>
      
      <h2 className="font-semibold text-lg text-[#212121]">Historique</h2>
      
      {completedOrders.length > 0 ? (
        <div className="space-y-3">
          {completedOrders.map((order) => (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-[#212121]">{order.client?.name || 'Client'}</h3>
                    <p className="text-sm text-[#757575]">{order.service?.name || 'Service'}</p>
                    <p className="text-xs text-[#9E9E9E] mt-1">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#4CAF50]">
                      {((order.totalPrice || 0) - (order.commission || 0)).toLocaleString()} XOF
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-[#9E9E9E]" />
          </div>
          <p className="font-medium text-[#757575]">Aucun historique</p>
          <p className="text-sm text-[#9E9E9E] mt-1">
            Vos lavages terminés apparaîtront ici.
          </p>
        </div>
      )}
    </div>
  );
}

// Washer Earnings
function WasherEarnings({ stats, onBack, onRefreshBalance, isRefreshingBalance, washerId }: { 
  stats: WasherStats;
  onBack: () => void;
  onRefreshBalance: () => void;
  isRefreshingBalance: boolean;
  washerId: string;
}) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [operator, setOperator] = useState('Mixx by Yas');
  const [isLoading, setIsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  // Trusted withdrawal numbers (max 3, self-confirmed; admin-only changes)
  const [numbers, setNumbers] = useState<any[]>([]);
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newOperator, setNewOperator] = useState('Mixx by Yas');
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Fetch withdrawals + trusted withdrawal numbers
  useEffect(() => {
    const fetchWithdrawals = async () => {
      try {
        const res = await fetch(`/api/withdrawals?washerId=${washerId}`);
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        if (data.success) {
          setWithdrawals(data.withdrawals);
        }
      } catch (error) {
        console.error('Fetch withdrawals error:', error);
      }
    };

    const fetchNumbers = async () => {
      try {
        const res = await fetch('/api/washers/withdrawal-numbers');
        const data = await parseJsonResponse<any>(res);
        if (data?.success) setNumbers(data.numbers ?? []);
      } catch (error) {
        console.error('Fetch withdrawal numbers error:', error);
      }
    };

    if (washerId) {
      fetchWithdrawals();
      fetchNumbers();
      // Auto-refresh while the earnings screen is open: a withdrawal request
      // can be approved/rejected by the admin at any moment.
      const interval = setInterval(fetchWithdrawals, 15000);
      return () => clearInterval(interval);
    }
  }, [washerId]);

  // Realtime: a payment notification (withdrawal approved/rejected) refreshes
  // the withdrawals list AND the earnings balance instantly.
  useEffect(() => {
    const off = onSoclineNotification((payload) => {
      if (payload?.type === 'payment' || payload?.type === 'PAYMENT') {
        onRefreshBalance();
        (async () => {
          try {
            const res = await fetch(`/api/withdrawals?washerId=${washerId}`);
            const data = await parseJsonResponse<any>(res);
            if (data?.success) setWithdrawals(data.withdrawals);
          } catch {
            // next poll will reconcile
          }
        })();
      }
    });
    return off;
  }, [washerId, onRefreshBalance]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount < 500) {
      toast.error('Le montant minimum est de 500 XOF');
      return;
    }
    
    if (amount > stats.totalEarnings) {
      toast.error('Solde insuffisant');
      return;
    }
    
    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error('Sélectionnez un numéro de retrait confirmé');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          washerId,
          amount,
          phoneNumber,
          operator,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        toast.success('Demande de retrait envoyée ! L\'administrateur a été notifié.');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setPhoneNumber('');
        onRefreshBalance();
        // Refresh withdrawals
        const res2 = await fetch(`/api/withdrawals?washerId=${washerId}`);
        const data2 = await parseJsonResponse<any>(res2);
        if (!data2) return;
        if (data2.success) {
          setWithdrawals(data2.withdrawals);
        }
      } else {
        toast.error(data.error || 'Erreur lors de la demande');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a trusted withdrawal number (initial self-service setup, max 3).
  const handleAddNumber = async () => {
    if (!/^\d{8}$/.test(newNumber)) {
      toast.error('Numéro invalide — 8 chiffres requis (ex: 90123456)');
      return;
    }

    setIsAddingNumber(true);
    try {
      const res = await fetch('/api/washers/withdrawal-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: newNumber, operator: newOperator }),
      });
      const data = await parseJsonResponse<any>(res);
      if (data?.success) {
        toast.success('Numéro confirmé ✅ — vous pouvez maintenant retirer vers ce numéro.');
        setNumbers((prev) => [...prev, data.number]);
        setNewNumber('');
        setShowAddNumber(false);
      } else {
        toast.error(data?.error || 'Erreur lors de l\'ajout');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setIsAddingNumber(false);
    }
  };

  // Send a modification request to the admin (admin-only changes).
  const handleSendChangeRequest = async () => {
    if (!changeMessage.trim()) {
      toast.error('Décrivez la modification souhaitée');
      return;
    }

    setIsSendingRequest(true);
    try {
      const res = await fetch('/api/washers/withdrawal-numbers/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: changeMessage }),
      });
      const data = await parseJsonResponse<any>(res);
      if (data?.success) {
        toast.success(data.message || 'Demande envoyée à l\'administrateur');
        setShowChangeRequest(false);
        setChangeMessage('');
      } else {
        toast.error(data?.error || 'Erreur lors de l\'envoi');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PROCESSING: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'Approuvé',
      PROCESSING: 'En cours',
      COMPLETED: 'Terminé',
      REJECTED: 'Refusé',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[#4CAF50]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </button>
      
      <h2 className="font-semibold text-lg text-[#212121]">Revenus</h2>

      {/* Total Earnings with Refresh */}
      <Card className="bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm opacity-80">Total des gains</p>
              <HideableBalanceDark
                balance={stats.totalEarnings}
                currency="XOF"
                size="xl"
                storageKey="hide-washer-total-earnings"
                className="mt-1"
              />
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Commencez à gagner!</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={onRefreshBalance}
                disabled={isRefreshingBalance}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                {isRefreshingBalance ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          {/* Withdraw Button */}
          <Button 
            onClick={() => setShowWithdrawModal(true)}
            className="w-full mt-4 bg-white text-[#4CAF50] hover:bg-white/90 font-semibold"
            disabled={stats.totalEarnings < 500}
          >
            <Banknote className="w-4 h-4 mr-2" />
            Retirer
          </Button>
          {stats.totalEarnings < 500 && (
            <p className="text-xs text-center mt-2 opacity-80">
              Minimum 500 XOF pour retirer
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-[#2196F3] mx-auto mb-2" />
            <p className="text-xs text-[#757575]">Cette semaine</p>
            <p className="text-lg font-bold text-[#212121]">0 XOF</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-[#4CAF50] mx-auto mb-2" />
            <p className="text-xs text-[#757575]">Ce mois</p>
            <p className="text-lg font-bold text-[#212121]">0 XOF</p>
          </CardContent>
        </Card>
      </div>

      {/* Trusted withdrawal numbers (max 3 — admin-only modifications) */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-[#212121] flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#4CAF50]" />
              Numéros de retrait confirmés
            </h3>
            <span className="text-xs text-[#9E9E9E]">{numbers.length}/3</span>
          </div>
          <p className="text-xs text-[#9E9E9E] mb-3">
            Seuls ces numéros peuvent recevoir vos retraits. Toute modification ultérieure passe par l’administrateur.
          </p>

          {numbers.length === 0 ? (
            <div className="bg-[#FFF8F0] border border-[#FFE0B2] rounded-xl p-3 text-sm text-[#8D6E63]">
              Aucun numéro confirmé — ajoutez-en un pour pouvoir retirer.
            </div>
          ) : (
            <div className="space-y-2">
              {numbers.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between bg-[#F5F5F5] rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-sm text-[#212121]">+228 {n.phoneNumber}</p>
                    <p className="text-xs text-[#757575]">{n.operator ?? '—'}{n.label ? ` • ${n.label}` : ''}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Confirmé</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {numbers.length < 3 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddNumber(true)}
                className="flex-1 border-[#4CAF50] text-[#4CAF50] hover:bg-[#E8F5E9]"
              >
                + Ajouter un numéro
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowChangeRequest(true)}
              className="flex-1 border-gray-300 text-[#757575]"
            >
              Demander une modification
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-[#212121]">Historique des retraits</h3>
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <Card key={w.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#212121]">{w.amount.toLocaleString()} XOF</p>
                    <p className="text-xs text-[#757575]">{w.phoneNumber} • {w.operator}</p>
                    <p className="text-xs text-[#9E9E9E]">
                      {new Date(w.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {getStatusBadge(w.status)}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#4CAF50]" />
              Demande de retrait
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Available Balance */}
            <div className="bg-[#E8F5E9] rounded-xl p-3 text-center">
              <p className="text-sm text-[#757575]">Solde disponible</p>
              <p className="text-xl font-bold text-[#4CAF50]">{stats.totalEarnings.toLocaleString()} XOF</p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Montant à retirer</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="500"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="h-12 text-lg"
                  min="500"
                  max={stats.totalEarnings}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575]">XOF</span>
              </div>
              <p className="text-xs text-[#9E9E9E]">Minimum: 500 XOF</p>
            </div>

            {/* Operator */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Opérateur Mobile Money</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOperator('Mixx by Yas')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    operator === 'Mixx by Yas' 
                      ? 'border-[#4CAF50] bg-[#E8F5E9]' 
                      : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium text-sm">Mixx by Yas</span>
                </button>
                <button
                  onClick={() => setOperator('Flooz')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    operator === 'Flooz' 
                      ? 'border-[#4CAF50] bg-[#E8F5E9]' 
                      : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium text-sm">Flooz</span>
                </button>
              </div>
            </div>

            {/* Phone Number — MUST be one of the trusted numbers */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Numéro de réception (confirmé)</label>
              {numbers.length === 0 ? (
                <div className="bg-[#FFF8F0] border border-[#FFE0B2] rounded-xl p-3">
                  <p className="text-sm text-[#8D6E63] mb-2">
                    Aucun numéro de retrait confirmé. Ajoutez-en un avant de retirer.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setShowAddNumber(true);
                    }}
                    className="border-[#4CAF50] text-[#4CAF50]"
                  >
                    + Ajouter un numéro
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {numbers.map((n: any) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setPhoneNumber(n.phoneNumber);
                        setOperator(n.operator ?? 'Mixx by Yas');
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                        phoneNumber === n.phoneNumber
                          ? 'border-[#4CAF50] bg-[#E8F5E9]'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-medium text-sm text-[#212121]">+228 {n.phoneNumber}</p>
                        <p className="text-xs text-[#757575]">{n.operator ?? '—'}</p>
                      </div>
                      {phoneNumber === n.phoneNumber && (
                        <CheckCircle className="w-5 h-5 text-[#4CAF50]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {withdrawAmount && parseFloat(withdrawAmount) >= 500 && (
              <div className="bg-[#F5F5F5] rounded-xl p-3">
                <div className="flex justify-between font-semibold">
                  <span>Montant à recevoir</span>
                  <span className="text-[#4CAF50]">
                    {parseFloat(withdrawAmount).toLocaleString()} XOF
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleWithdraw}
              disabled={isLoading || !withdrawAmount || parseFloat(withdrawAmount) < 500 || !phoneNumber || numbers.length === 0}
              className="w-full h-12 bg-[#4CAF50] hover:bg-[#43A047] text-white font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Confirmer la demande'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Trusted Number Dialog */}
      <Dialog open={showAddNumber} onOpenChange={setShowAddNumber}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#4CAF50]" />
              Ajouter un numéro de retrait
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#FFF8F0] border border-[#FFE0B2] rounded-xl p-3 text-xs text-[#8D6E63]">
              Confirmez ce numéro : il pourra recevoir vos retraits. Maximum 3 numéros. Toute modification ultérieure sera faite uniquement par l’administrateur, après votre demande.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Numéro Mobile Money</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]">+228</span>
                <Input
                  type="tel"
                  placeholder="90 12 34 56"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="pl-14 h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Opérateur</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewOperator('Mixx by Yas')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    newOperator === 'Mixx by Yas' ? 'border-[#4CAF50] bg-[#E8F5E9]' : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium text-sm">Mixx by Yas</span>
                </button>
                <button
                  onClick={() => setNewOperator('Flooz')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    newOperator === 'Flooz' ? 'border-[#4CAF50] bg-[#E8F5E9]' : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium text-sm">Flooz</span>
                </button>
              </div>
            </div>
            <Button
              onClick={handleAddNumber}
              disabled={isAddingNumber || !/^\d{8}$/.test(newNumber)}
              className="w-full h-12 bg-[#4CAF50] hover:bg-[#43A047] text-white font-semibold"
            >
              {isAddingNumber ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmer ce numéro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modification Request Dialog (admin-only changes) */}
      <Dialog open={showChangeRequest} onOpenChange={setShowChangeRequest}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demander une modification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#F5F5F5] rounded-xl p-3">
              <p className="text-xs text-[#757575] mb-2">Vos numéros actuels :</p>
              {numbers.length === 0 ? (
                <p className="text-sm text-[#212121]">Aucun numéro</p>
              ) : (
                numbers.map((n: any) => (
                  <p key={n.id} className="text-sm text-[#212121]">+228 {n.phoneNumber} • {n.operator ?? '—'}</p>
                ))
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Votre demande (remplacement, suppression…)</label>
              <textarea
                placeholder="Ex : remplacer le numéro 90123456 par 91234567"
                value={changeMessage}
                onChange={(e) => setChangeMessage(e.target.value)}
                className="w-full p-3 border border-[#E0E0E0] rounded-xl resize-none h-24 text-sm focus:outline-none focus:border-[#4CAF50]"
              />
              <p className="text-xs text-[#9E9E9E]">
                Seul l’administrateur peut modifier vos numéros. Il sera notifié immédiatement.
              </p>
            </div>
            <Button
              onClick={handleSendChangeRequest}
              disabled={isSendingRequest || !changeMessage.trim()}
              className="w-full h-12 bg-[#4CAF50] hover:bg-[#43A047] text-white font-semibold"
            >
              {isSendingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer la demande'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Washer Profile
function WasherProfile({ user, stats, onLogout, onBack, onNavigate }: { 
  user: User | null; 
  stats: WasherStats; 
  onLogout: () => void;
  onBack: () => void;
  onNavigate: (section: string) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[#4CAF50]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </button>
      
      {/* Profile Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] rounded-full flex items-center justify-center text-white text-xl font-bold">
              {user?.name?.charAt(0) || 'L'}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[#212121]">{user?.name || 'Laveur'}</h2>
              <p className="text-sm text-[#757575]">+228 {user?.phone || ''}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('edit-profile')}>
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#212121] mb-3">Statistiques</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-[#4CAF50]">{stats.completedJobs}</div>
              <div className="text-xs text-[#757575]">Lavages</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#FFC107]">{stats.rating > 0 ? stats.rating.toFixed(1) : '-'}</div>
              <div className="text-xs text-[#757575]">Note</div>
            </div>
            <div className="text-center">
              <HideableBalanceLight
                balance={stats.totalEarnings}
                currency="XOF"
                size="md"
                storageKey="hide-washer-profile-earnings"
                balanceClassName="text-[#2196F3]"
                showToggle={false}
              />
              <div className="text-xs text-[#757575]">Gains</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu */}
      <Card className="border-0 shadow-sm overflow-hidden">
        {[
          { icon: Car, label: 'Mes services', section: 'services' },
          { icon: Clock, label: 'Horaires', section: 'schedule' },
          { icon: Wallet, label: 'Paiements', section: 'payments' },
          { icon: Bell, label: 'Notifications', section: 'notifications' },
          { icon: Settings, label: 'Paramètres', section: 'settings' },
        ].map((item, index) => (
          <button
            key={index}
            onClick={() => onNavigate(item.section)}
            className="w-full flex items-center gap-3 p-4 hover:bg-[#F5F5F5] transition-colors border-b border-[#F5F5F5] last:border-0"
          >
            <div className="w-8 h-8 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
              <item.icon className="w-4 h-4 text-[#4CAF50]" />
            </div>
            <span className="flex-1 text-left text-[#212121] text-sm">{item.label}</span>
            <div className="w-5 h-5 text-[#9E9E9E]">›</div>
          </button>
        ))}
      </Card>

      {/* Logout Button */}
      <Button
        onClick={onLogout}
        variant="outline"
        className="w-full h-12 border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-semibold"
      >
        <LogOut className="w-5 h-5 mr-2" />
        Déconnexion
      </Button>
    </div>
  );
}

// Washer Profile Section
function WasherProfileSection({ section, onBack, user }: { 
  section: string; 
  onBack: () => void;
  user: User | null;
}) {
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const getSectionTitle = () => {
    switch (section) {
      case 'services': return 'Mes services';
      case 'schedule': return 'Horaires';
      case 'payments': return 'Paiements';
      case 'notifications': return 'Notifications';
      case 'settings': return 'Paramètres';
      case 'edit-profile': return 'Modifier le profil';
      default: return 'Paramètres';
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, name }),
      });
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        toast.success('Profil mis à jour');
        onBack();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[#4CAF50]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </button>
      
      <h2 className="font-semibold text-lg text-[#212121]">{getSectionTitle()}</h2>

      {section === 'edit-profile' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm text-[#757575]">Nom complet</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-[#757575]">Téléphone</label>
              <Input
                value={user?.phone || ''}
                disabled
                className="mt-1 bg-gray-50"
              />
            </div>
            <Button 
              onClick={handleSaveProfile} 
              className="w-full bg-[#4CAF50] hover:bg-[#43A047]"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      )}

      {section === 'services' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[#757575] text-sm">
              Gérez les services que vous proposez. Cette fonctionnalité sera bientôt disponible.
            </p>
          </CardContent>
        </Card>
      )}

      {section === 'schedule' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[#757575] text-sm">
              Définissez vos horaires de disponibilité. Cette fonctionnalité sera bientôt disponible.
            </p>
          </CardContent>
        </Card>
      )}

      {section === 'payments' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[#757575] text-sm">
              Gérez vos informations bancaires pour les retraits. Cette fonctionnalité sera bientôt disponible.
            </p>
          </CardContent>
        </Card>
      )}

      {section === 'notifications' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <PushNotificationSetup
              title="Notifications push"
              description="Recevoir les alertes de nouvelles commandes"
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#212121]">Notifications SMS</p>
                <p className="text-xs text-[#757575]">Recevoir les mises à jour par SMS</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      )}

      {section === 'settings' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="font-medium text-[#212121]">Langue</p>
              <p className="text-sm text-[#757575]">Français</p>
            </div>
            <div>
              <p className="font-medium text-[#212121]">Version de l&apos;application</p>
              <p className="text-sm text-[#757575]">1.0.0</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
