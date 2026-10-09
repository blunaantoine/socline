'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useOrdersStore, useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DynamicLeafletMap } from '@/components/map/DynamicLeafletMap';
import { ChatView } from '@/components/chat/ChatView';
import { CarPhoto } from '@/components/shared/CarPhoto';
import { formatScheduledLong } from '@/lib/scheduled';
import { formatPrice } from '@/lib/service-coverage';
import { openWhatsApp } from '@/lib/contact';
import {
  MapPin, Phone, MessageCircle, MessageSquare, Clock, Star, Heart,
  CheckCircle, Navigation, AlertCircle, X, ArrowLeft, Home, Loader2, Camera,
  CalendarCheck
} from 'lucide-react';
import type { Order, OrderStatus, TrackingEvent, Conversation } from '@/types';
import { isRealtimeEnabled } from '@/lib/realtime-flag';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface OrderTrackingProps {
  order: Order;
  onBack?: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: typeof CheckCircle; progress: number }> = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock, progress: 10 },
  ACCEPTED: { label: 'Acceptée', color: 'bg-blue-100 text-blue-800', icon: CheckCircle, progress: 25 },
  EN_ROUTE: { label: 'En route', color: 'bg-blue-100 text-blue-800', icon: Navigation, progress: 50 },
  ARRIVED: { label: 'Arrivé', color: 'bg-green-100 text-green-800', icon: MapPin, progress: 75 },
  IN_PROGRESS: { label: 'En cours', color: 'bg-purple-100 text-purple-800', icon: CheckCircle, progress: 90 },
  COMPLETED: { label: 'Terminée', color: 'bg-green-100 text-green-800', icon: CheckCircle, progress: 100 },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-800', icon: X, progress: 0 },
};

// Haversine distance in kilometers between two (lat, lng) points.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Average city driving speed used for the ETA estimate (km/h).
const WASHER_SPEED_KMH = 25;

// Default map center (Lomé, Togo) — used when neither the order nor the
// washer has coordinates yet.
const DEFAULT_MAP_CENTER: [number, number] = [6.1725, 1.2314];

// Human-readable distance ("850 m" / "1,2 km") between the washer and the
// service location. Returns null when either position is missing.
function formatDistanceKm(km: number | null): string | null {
  if (km == null || !isFinite(km)) return null;
  if (km < 1) return `${Math.max(10, Math.round(km * 1000 / 10) * 10)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

// Format a timestamp as HH:MM (fr-FR).
function formatTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Initials from a full name (e.g. "Mamadou Diop" → "MD").
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || '?';
}

export function OrderTracking({ order, onBack }: OrderTrackingProps) {
  const { updateOrder, setCurrentOrder } = useOrdersStore();
  const [washerLocation, setWasherLocation] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  // Discussion de la commande : même conversation partagée que le laveur
  // (créée à la volée par GET /api/conversations?orderId pour les participants).
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  // Ouvre la discussion de la commande (identique au comportement laveur :
  // GET /api/conversations?orderId= crée la conversation si elle n'existe
  // pas encore — les deux côtés tombent donc sur la même conversation).
  const handleOpenChat = useCallback(async () => {
    if (isOpeningChat) return;
    setIsOpeningChat(true);
    try {
      const res = await fetch(`/api/conversations?orderId=${order.id}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.conversation) {
        setConversation(data.conversation);
        setShowChat(true);
      } else {
        toast.error(data?.error || 'Discussion indisponible pour cette commande');
      }
    } catch {
      toast.error('Erreur réseau — discussion indisponible');
    } finally {
      setIsOpeningChat(false);
    }
  }, [order.id, isOpeningChat]);

  // ---------------------------------------------------------------------
  // Realtime: socket connected to the authenticated mini-service.
  // The API emits 'order:updated' (status transitions) and the location
  // endpoint emits 'washer-location' (washer GPS) into the order room.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const initSocket = async () => {
      // Serverless demo (Vercel): realtime disabled, polling fallbacks only.
      if (!isRealtimeEnabled()) return;

      const token = useAuthStore.getState().token;
      if (!token) {
        console.warn('[Tracking] No auth token — realtime disabled, polling only');
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
        socket.emit('join-order-tracking', order.id);
      });

      socket.on('order:updated', (payload: Order) => {
        if (cancelled || !payload || payload.id !== order.id) return;
        setCurrentOrder(payload);
        updateOrder(payload);
      });

      socket.on('washer-location', (payload: { orderId: string; latitude: number; longitude: number; timestamp: string }) => {
        if (cancelled || !payload || payload.orderId !== order.id) return;
        setWasherLocation({ lat: payload.latitude, lng: payload.longitude, at: payload.timestamp });
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
  }, [order.id, setCurrentOrder, updateOrder]);

  // ---------------------------------------------------------------------
  // Fallback polling (safety net if the socket drops): light 15s GET that
  // reconciles the status with the DB.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok) return;
        // Fetch + hydrate: the GET response carries the persisted tracking
        // events, so the last known washer position survives a page reload
        // (before any live socket push arrives).
        const data = await res.json();
        if (data?.success && data.order) {
          setWasherLocation((prev) => {
            if (prev) return prev; // a live socket position is fresher
            const events: TrackingEvent[] = Array.isArray(data.order.tracking)
              ? data.order.tracking
              : [];
            const lastLoc = events.find(
              (t) => t.event === 'WASHER_LOCATION' &&
                t.latitude != null && t.longitude != null
            );
            if (!lastLoc || lastLoc.latitude == null || lastLoc.longitude == null) return prev;
            return { lat: lastLoc.latitude, lng: lastLoc.longitude, at: lastLoc.createdAt };
          });
          if (data.order.status !== order.status) {
            setCurrentOrder(data.order);
            updateOrder(data.order);
          }
        }
      } catch {
        // Network hiccup — next tick will retry.
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [order.id, order.status, setCurrentOrder, updateOrder]);

  const config = STATUS_CONFIG[order.status];
  const StatusIcon = config.icon;

  // ---------------------------------------------------------------------
  // Live map: client marker (service location) + washer marker (last known
  // GPS from the socket stream or hydrated tracking history).
  // ---------------------------------------------------------------------
  const orderCoords: [number, number] | null =
    order.latitude != null && order.longitude != null
      ? [order.latitude, order.longitude]
      : null;

  const mapMarkers = useMemo(() => {
    const list: { id: string; type: 'CLIENT' | 'WASHER'; position: [number, number]; label?: string }[] = [];
    if (orderCoords) {
      list.push({ id: 'client', type: 'CLIENT', position: orderCoords, label: 'Adresse du lavage' });
    }
    if (washerLocation) {
      list.push({
        id: 'washer',
        type: 'WASHER',
        position: [washerLocation.lat, washerLocation.lng],
        label: 'Laveur',
      });
    }
    return list;
  }, [orderCoords, washerLocation]);

  const mapCenter: [number, number] =
    orderCoords ?? (washerLocation ? [washerLocation.lat, washerLocation.lng] : DEFAULT_MAP_CENTER);

  // ETA: only with a real washer position AND order coordinates.
  const washerDistanceKm =
    washerLocation && orderCoords
      ? haversineKm(washerLocation.lat, washerLocation.lng, orderCoords[0], orderCoords[1])
      : null;
  const washerDistanceLabel = formatDistanceKm(washerDistanceKm);

  const etaMinutes =
    washerDistanceKm != null
      ? Math.max(1, Math.round((washerDistanceKm / WASHER_SPEED_KMH) * 60))
      : null;

  // Cancel the order (client, while PENDING/ACCEPTED).
  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: 'CANCELLED' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Impossible d\u2019annuler la commande');
        return;
      }
      // The socket / polling reconciles the UI from the server response.
      if (data.order) {
        setCurrentOrder(data.order);
        updateOrder(data.order);
      }
    } catch {
      toast.error('Erreur réseau lors de l\u2019annulation');
    } finally {
      setIsCancelling(false);
    }
  };

  if (order.status === 'COMPLETED') {
    return <OrderCompleted order={order} onBack={onBack} onGoHome={() => setCurrentOrder(null)} />;
  }

  const washer = order.washer;

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] relative">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] hidden md:flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-2 bg-white rounded-sm"></div>
            <div className="w-1 h-3 bg-white rounded-sm"></div>
            <div className="w-1 h-4 bg-white rounded-sm"></div>
          </div>
          <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>

      {/* Header with Back Button */}
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 md:top-6 z-40 max-md:pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onBack} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-[#212121]" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[#212121]">Suivi de commande</h1>
          <p className="text-xs text-[#757575]">{order.orderNumber}</p>
        </div>
      </div>

      {/* Live map — real Leaflet map (client + washer markers) when the order
          or the washer has coordinates; graceful placeholder otherwise.
          GRANDE hauteur : le client doit pouvoir suivre le déplacement du
          laveur à l'œil nu. */}
      <div className="h-[45dvh] max-h-[420px] min-h-[280px] relative flex-shrink-0">
        {(orderCoords || washerLocation) ? (
          <DynamicLeafletMap
            center={mapCenter}
            zoom={14}
            height="100%"
            className="h-full"
            markers={mapMarkers}
            fitToMarkers
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-blue-100 to-green-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Navigation className="w-12 h-12 text-blue-600 mx-auto mb-2 animate-bounce" />
                <p className="text-gray-600">Carte en temps réel</p>
                <p className="text-xs text-gray-500 mt-1">Position indisponible pour cette commande</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 left-4 right-4 z-[900]">
          <Badge className={`${config.color} text-base px-4 py-2`}>
            <StatusIcon className="w-4 h-4 mr-2" />
            {config.label}
          </Badge>
          {/* Real order timestamps (subtle) */}
          {(order.acceptedAt || order.startedAt || order.completedAt) && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {order.acceptedAt && (
                <span className="text-[11px] bg-white/80 rounded-full px-2 py-0.5 text-[#616161]">
                  Acceptée à {formatTime(order.acceptedAt)}
                </span>
              )}
              {order.startedAt && (
                <span className="text-[11px] bg-white/80 rounded-full px-2 py-0.5 text-[#616161]">
                  Départ à {formatTime(order.startedAt)}
                </span>
              )}
              {order.completedAt && (
                <span className="text-[11px] bg-white/80 rounded-full px-2 py-0.5 text-[#616161]">
                  Terminée à {formatTime(order.completedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Panneaux d'information du laveur — empilés dans UN SEUL conteneur
            (jamais de superposition : distance, ETA et attente se rangent
            proprement les uns sous les autres). */}
        <div className="absolute bottom-4 left-4 right-4 z-[900] flex flex-col gap-2 pointer-events-none">
          {order.status === 'EN_ROUTE' && !washerLocation && (
            <div className="bg-white rounded-lg p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                <span className="text-sm text-[#616161]">En attente de la position du laveur…</span>
              </div>
            </div>
          )}

          {washerLocation && (
            <div className="bg-white rounded-lg p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-[#212121]">
                    {washerDistanceLabel
                      ? `Le laveur est à ${washerDistanceLabel}${order.status === 'EN_ROUTE' ? ' de vous' : ''}`
                      : 'Position du laveur reçue'}
                  </span>
                  <span className="block text-xs text-[#757575]">
                    Mise à jour à {formatTime(washerLocation.at)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Estimated arrival from the real washer position */}
          {order.status === 'EN_ROUTE' && etaMinutes !== null && (
            <div className="bg-white rounded-lg p-3 shadow-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Arrivée estimée</span>
                </div>
                <span className="text-xl font-bold text-blue-600">~{etaMinutes} min</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps - Android Stepper Style */}
      <div className="bg-white px-4 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between">
          {[
            { status: 'PENDING', label: 'Commande', icon: Clock },
            { status: 'ACCEPTED', label: 'Acceptée', icon: CheckCircle },
            { status: 'EN_ROUTE', label: 'En route', icon: Navigation },
            { status: 'ARRIVED', label: 'Arrivé', icon: MapPin },
            { status: 'IN_PROGRESS', label: 'En cours', icon: CheckCircle },
          ].map((item, index) => {
            const statusOrder = ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
            const currentIndex = statusOrder.indexOf(order.status);
            const itemIndex = statusOrder.indexOf(item.status);
            const isActive = order.status === item.status ||
              (order.status === 'COMPLETED' && item.status === 'IN_PROGRESS');
            const isPast = itemIndex < currentIndex || order.status === 'COMPLETED';
            const Icon = item.icon;

            return (
              <div key={item.status} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-[#FF9800] text-white shadow-lg shadow-[#FF9800]/30'
                        : isPast
                        ? 'bg-[#4CAF50] text-white'
                        : 'bg-[#E0E0E0] text-[#9E9E9E]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-[9px] mt-0.5 font-medium whitespace-nowrap ${
                    isActive ? 'text-[#FF9800]' : isPast ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 4 && (
                  <div className={`flex-1 h-0.5 mx-0.5 transition-all ${
                    isPast ? 'bg-[#4CAF50]' : 'bg-[#E0E0E0]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Details */}
      <div className="flex-1 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] p-4 space-y-4">
        {/* Service Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{order.service.name}</h3>
                <p className="text-sm text-gray-500">{order.address}</p>
              </div>
              {order.isSubscriptionOrder ? (
                <span className="text-sm font-bold text-purple-700 bg-purple-100 rounded-full px-3 py-1">
                  👑 Séance abonnement
                </span>
              ) : (
                <span className="text-xl font-bold text-blue-600">
                  {formatPrice(order.totalPrice)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle being washed — matches what the washer sees */}
        {order.car && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {order.car.photo ? (
                  <img
                    src={order.car.photo}
                    alt={`Voiture ${order.car.plateNumber}`}
                    className="w-14 h-14 rounded-xl object-cover border flex-shrink-0"
                  />
                ) : (
                  <CarPhoto
                    alt={`Photo du véhicule ${order.car.plateNumber}`}
                    className="w-14 h-14 rounded-xl border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#212121]">
                    {[order.car.brand, order.car.model].filter(Boolean).join(' ') || 'Votre véhicule'}
                  </p>
                  <p className="text-xs text-gray-500">{order.car.color}{order.car.year ? ` • ${order.car.year}` : ''}</p>
                  <Badge variant="outline" className="mt-0.5 font-mono text-xs">{order.car.plateNumber}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Washer Info — real assigned washer (hidden while none assigned) */}
        {order.status !== 'PENDING' && washer && (
          <Card>
            <CardContent className="p-4">
              {/* Identité */}
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-green-400 text-white text-lg">
                    {initials(washer.user?.name || 'Laveur')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{washer.user?.name || 'Laveur Socline'}</h3>
                  <div className="flex items-center gap-1 min-w-0">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <span className="text-sm">{washer.rating != null ? washer.rating.toFixed(1) : '—'}</span>
                    <span className="text-gray-300 mx-1">•</span>
                    <span className="text-sm text-gray-500 truncate">{washer.completedJobs ?? 0} lavages</span>
                  </div>
                </div>
              </div>
              {/* Actions de contact — grille pleine largeur : aucun débordement
                  même sur petits écrans (le trio en rangée serrée débordait). */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {/* Appel : ouvre le composeur du téléphone avec le numéro du laveur */}
                <Button
                  variant="outline"
                  className="h-10 text-xs font-semibold gap-1.5 px-2"
                  aria-label="Appeler le laveur"
                  disabled={!washer.user?.phone}
                  onClick={() => washer.user?.phone && window.open(`tel:${washer.user.phone}`, '_self')}
                >
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  Appeler
                </Button>
                {/* WhatsApp : ouvre une discussion WhatsApp pré-remplie avec le
                    numéro du laveur (repli fiable si l'appel ne passe pas). */}
                <Button
                  variant="outline"
                  className="h-10 text-xs font-semibold gap-1.5 px-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white"
                  aria-label="Contacter le laveur sur WhatsApp"
                  disabled={!washer.user?.phone}
                  onClick={() => openWhatsApp(
                    washer.user?.phone,
                    `Bonjour, je vous contacte au sujet de ma commande Socline ${order.orderNumber}.`
                  )}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  WhatsApp
                </Button>
                {/* Discussion : ouvre la conversation temps réel de la commande
                    (la même que celle du laveur). */}
                <Button
                  variant="outline"
                  className="h-10 text-xs font-semibold gap-1.5 px-2"
                  aria-label="Ouvrir la discussion"
                  onClick={handleOpenChat}
                  disabled={isOpeningChat}
                >
                  {isOpeningChat
                    ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    : <MessageCircle className="w-4 h-4 flex-shrink-0" />}
                  Message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {order.status === 'PENDING' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                {order.scheduledAt ? 'Rendez-vous planifié' : "Recherche d'un laveur"}
              </p>
              <p className="text-sm text-yellow-700">
                {order.scheduledAt
                  ? `Rendez-vous demandé ${formatScheduledLong(order.scheduledAt) || ''} — en attente de confirmation d'un laveur.`
                  : 'Nous recherchons un laveur disponible près de vous...'}
              </p>
            </div>
          </div>
        )}

        {/* Rendez-vous planifié confirmé par le laveur (option C) */}
        {order.status === 'ACCEPTED' && order.scheduledAt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CalendarCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Rendez-vous confirmé</p>
              <p className="text-sm text-green-700">
                {order.washer?.user?.name || 'Votre laveur'} passera {formatScheduledLong(order.scheduledAt) || ''} à : {order.address || 'adresse convenue'}.
              </p>
            </div>
          </div>
        )}

        {order.status === 'ARRIVED' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <MapPin className="w-5 h-5" />
              <span className="font-medium">Le laveur est arrivé!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Il vous attend à l&apos;adresse indiquée.
            </p>
          </div>
        )}

        {order.status === 'IN_PROGRESS' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-800">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Lavage en cours</span>
            </div>
            <p className="text-sm text-purple-700 mt-1">
              Durée estimée: ~{order.service.duration} minutes
            </p>
          </div>
        )}
      </div>

      {/* Cancel Button — works against PATCH /api/orders (client cancel) */}
      {['PENDING', 'ACCEPTED'].includes(order.status) && (
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isCancelling ? 'Annulation...' : 'Annuler la commande'}
          </Button>
        </div>
      )}

      {/* Discussion temps réel de la commande — plein écran par-dessus le suivi,
          même conversation partagée que le côté laveur. z-index > 1000 : au-dessus
          des panneaux de carte (z-900) et des couches Leaflet (z-200..1000). */}
      {showChat && conversation && (
        <div className="absolute inset-0 z-[1100] bg-[#FAFAFA] flex flex-col">
          <ChatView
            conversation={conversation}
            onBack={() => setShowChat(false)}
          />
        </div>
      )}
    </div>
  );
}

// Order Completed Component
function OrderCompleted({ order, onBack, onGoHome }: { order: Order; onBack?: () => void; onGoHome: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (rating === 0 || isSubmitting) return;
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
          ? 'Merci ! Votre avis est enregistré et le laveur ajouté à vos favoris ❤️'
          : 'Merci pour votre avis ⭐'
      );
      setSubmitted(true);
    } catch {
      toast.error('Erreur réseau — avis non envoyé');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col bg-[#FAFAFA]">
        {/* Android Status Bar */}
        <div className="h-6 bg-[#FF9800] hidden md:flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
          <span className="text-white text-xs font-medium">9:41</span>
          <div className="flex items-center gap-1">
            <div className="flex items-end gap-0.5">
              <div className="w-1 h-1 bg-white rounded-sm"></div>
              <div className="w-1 h-2 bg-white rounded-sm"></div>
              <div className="w-1 h-3 bg-white rounded-sm"></div>
              <div className="w-1 h-4 bg-white rounded-sm"></div>
            </div>
            <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
              <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }}></div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-[#212121]">Merci!</h2>
              <p className="text-[#757575] mb-4">
                Votre avis a été enregistré. À bientôt sur Socline!
              </p>
              <Button onClick={onGoHome} className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl">
                <Home className="w-4 h-4 mr-2" />
                Retour à l&apos;accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA]">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] hidden md:flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-2 bg-white rounded-sm"></div>
            <div className="w-1 h-3 bg-white rounded-sm"></div>
            <div className="w-1 h-4 bg-white rounded-sm"></div>
          </div>
          <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] p-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Back Button */}
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 text-[#757575] mb-2">
              <ArrowLeft className="w-5 h-5" />
              <span>Retour</span>
            </button>
          )}

          {/* Success Card */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-1 text-[#212121]">Lavage terminé!</h2>
              <p className="text-[#757575] text-sm">
                Votre véhicule est propre et brillant.
              </p>
              <div className="mt-3 p-3 bg-[#F5F5F5] rounded-xl">
                <div className="text-xs text-[#757575]">
                  {order.isSubscriptionOrder
                    ? 'Prestation réglée via votre abonnement'
                    : order.payment?.method === 'CASH' ? 'À payer en espèces' : 'Total payé'}
                </div>
                {order.isSubscriptionOrder ? (
                  <div className="text-lg font-bold text-purple-700">
                    👑 Séance abonnement
                  </div>
                ) : (
                  <div className="text-xl font-bold text-[#FF9800]">
                    {formatPrice(order.totalPrice)}
                  </div>
                )}
                {order.payment?.method === 'CASH' && (
                  <p className="text-xs text-[#E65100] mt-1">💵 Réglez ce montant au laveur.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Verification photos — proof of service (before/after) */}
          {(order.beforePhotoUrl || order.afterPhotoUrl) && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-[#212121] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#FF9800]" />
                  Photos de vérification
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {order.beforePhotoUrl && (
                    <div>
                      <img
                        src={order.beforePhotoUrl}
                        alt="Voiture avant le lavage"
                        className="w-full h-28 object-cover rounded-lg border"
                      />
                      <p className="text-xs text-center text-[#757575] mt-1">Avant le lavage</p>
                    </div>
                  )}
                  {order.afterPhotoUrl && (
                    <div>
                      <img
                        src={order.afterPhotoUrl}
                        alt="Voiture après le lavage"
                        className="w-full h-28 object-cover rounded-lg border"
                      />
                      <p className="text-xs text-center text-[#757575] mt-1">Après le lavage</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rating Card */}
          {!order.review && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-center text-[#212121]">Notez votre expérience</h3>

                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110"
                      aria-label={`Noter ${star} étoile${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  placeholder="Laissez un commentaire (optionnel)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full p-3 border border-[#E0E0E0] rounded-xl resize-none h-20 text-sm focus:outline-none focus:border-[#FF9800]"
                />

                {/* Favorite washer toggle */}
                {order.washer && (
                  <button
                    type="button"
                    onClick={() => setFavorite((v) => !v)}
                    className={`w-full mt-3 flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all ${
                      favorite
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-[#E0E0E0] bg-white text-[#757575]'
                    }`}
                    aria-pressed={favorite}
                  >
                    <Heart className={`w-5 h-5 ${favorite ? 'fill-red-500 text-red-500' : ''}`} />
                    <span className="text-sm font-medium">
                      {favorite
                        ? `${order.washer.user?.name || 'Ce laveur'} est dans vos favoris`
                        : `Ajouter ${order.washer.user?.name || 'ce laveur'} en favori`}
                    </span>
                  </button>
                )}

                <Button
                  className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl mt-3"
                  onClick={handleSubmitReview}
                  disabled={rating === 0 || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? 'Envoi…' : 'Envoyer mon avis'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
