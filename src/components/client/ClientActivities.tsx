'use client';

/**
 * Mes activités — hub client unique regroupant :
 *  · En cours    : lavages immédiats actifs (recherche de laveur → lavage en
 *                  cours), avec suivi en direct en un clic ;
 *  · Planifiées  : réservations avec rendez-vous (badge date, statut de
 *                  confirmation du laveur, rappel H-2h annoncé) ;
 *  · Historique  : commandes terminées / annulées (détail complet réutilisé
 *                  depuis OrderHistory) ;
 *  · Abonnement  : abonnement actif, progression des séances (étapes
 *                  validées / en attente / restantes) + accès aux formules.
 *
 * Données : GET /api/orders (session) + GET /api/subscriptions/user
 * (includeHistory) — rafraîchies toutes les 20 s, au retour sur l'app et à
 * chaque notification temps réel de commande.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Segmented } from '@/components/design/Segmented';
import { EmptyState } from '@/components/design/EmptyState';
import { ScheduledBadge } from '@/components/shared/ScheduledBadge';
import { formatScheduledLong } from '@/lib/scheduled';
import { formatPrice } from '@/lib/service-coverage';
import { parseJsonResponse } from '@/lib/json-helper';
import { useAutoRefresh, type RefreshSource } from '@/hooks/useAutoRefresh';
import { onSoclineNotification } from '@/components/RealtimeNotifications';
import { OrderDetails } from './OrderHistory';
import { SubscriptionPanel } from './SubscriptionPanel';
import { planPriorityImage } from '@/lib/design-system';
import type { Order, OrderStatus } from '@/types';
import {
  Zap, Droplets, Sparkles, Crown, MapPin, Loader2, User, Star,
  CalendarClock, ArrowLeft, Inbox, CheckCircle2, Clock, Bell,
  BadgeCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------
// Constantes d'affichage
// ---------------------------------------------------------------------

/** Statuts d'une commande « active » (non terminée / annulée). */
const ACTIVE_STATUSES: OrderStatus[] = [
  'PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
];

const STATUS_META: Record<OrderStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Recherche de laveur', badge: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED: { label: 'Laveur assigné', badge: 'bg-blue-100 text-blue-800' },
  EN_ROUTE: { label: 'Laveur en route', badge: 'bg-blue-100 text-blue-800' },
  ARRIVED: { label: 'Laveur arrivé', badge: 'bg-green-100 text-green-800' },
  IN_PROGRESS: { label: 'Lavage en cours', badge: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Terminée', badge: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Annulée', badge: 'bg-red-100 text-red-700' },
};

type ActivityTab = 'ongoing' | 'planned' | 'history' | 'subscription';

interface ActivitySubscription {
  id: string;
  plan: {
    id: string;
    displayName?: string;
    name: string;
    priority: number;
    price: number;
    washCount: number;
    service?: { id: string; name: string } | null;
  };
  duration: string;
  paidAmount: number;
  totalWashes: number;
  usedWashes: number;
  remainingWashes: number;
  freeOptionsUsed: number;
  freeOptionsTotal: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isExpired: boolean;
  usages?: ActivityUsage[];
}

interface ActivityUsage {
  id: string;
  orderId: string | null;
  usedAt: string;
  serviceName: string;
  washType: string;
  address: string | null;
  status: 'PENDING' | 'VALIDATED' | 'CANCELLED';
  validatedAt: string | null;
}

// ---------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------

export function ClientActivities({
  userId,
  walletBalance,
  onTrack,
  onBooking,
}: {
  /** Id de l'utilisateur connecté (pour le panneau des formules). */
  userId: string;
  walletBalance: number;
  /** Ouvre le suivi temps réel d'une commande (écran OrderTracking). */
  onTrack: (order: Order) => void;
  /** Ouvre le parcours de réservation (onglet Réserver). */
  onBooking: () => void;
}) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<ActivityTab>('ongoing');
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscription, setSubscription] = useState<ActivitySubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);

  // Chargement : commandes + abonnement (avec historique des séances)
  const refresh = useCallback(
    async (source: RefreshSource = 'initial') => {
      if (!user?.id) return;
      if (source === 'initial') setIsLoading(true);
      try {
        const [ordersRes, subsRes] = await Promise.all([
          fetch(`/api/orders?userId=${user.id}&role=CLIENT`),
          fetch(`/api/subscriptions/user?userId=${user.id}&includeHistory=true`),
        ]);

        const ordersData = await parseJsonResponse<{ success?: boolean; orders?: Order[] }>(ordersRes);
        if (ordersData?.success && Array.isArray(ordersData.orders)) {
          setOrders(ordersData.orders);
        }

        const subsData = await parseJsonResponse<{ success?: boolean; subscriptions?: ActivitySubscription[] }>(subsRes);
        if (subsData?.success) {
          const list = Array.isArray(subsData.subscriptions) ? subsData.subscriptions : [];
          const active = list.find((s) => s.isActive && !s.isExpired) || null;
          setSubscription(active);
        }
      } catch (error) {
        console.error('ClientActivities fetch error:', error);
      } finally {
        if (source === 'initial') setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Auto-refresh 20 s + retour sur l'app
  useAutoRefresh(refresh, 20000);

  // Temps réel : une notification de commande → rafraîchissement silencieux
  useEffect(() => {
    return onSoclineNotification((notif) => {
      if (notif?.type === 'order') refresh('interval');
    });
  }, [refresh]);

  // Répartition des commandes par segment
  const { ongoing, planned, history } = useMemo(() => {
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    const immediate = active.filter((o) => !o.scheduledAt);
    const scheduled = active
      .filter((o) => o.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    const past = orders
      .filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED')
      .sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt).getTime() -
          new Date(a.completedAt || a.createdAt).getTime()
      );
    return { ongoing: immediate, planned: scheduled, history: past };
  }, [orders]);

  const usages = useMemo(() => {
    const list = subscription?.usages ?? [];
    return [...list].sort(
      (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
    );
  }, [subscription]);

  const segments: Array<{ value: ActivityTab; label: string }> = [
    { value: 'ongoing', label: 'En cours' },
    { value: 'planned', label: 'Planifiées' },
    { value: 'history', label: 'Historique' },
    { value: 'subscription', label: 'Abonnement' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Sélecteur de section */}
      <Segmented dense options={segments} value={tab} onChange={setTab} />

      {isLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-7 h-7 animate-spin text-brand" />
        </div>
      ) : (
        <>
          {tab === 'ongoing' && (
            <OngoingList
              orders={ongoing}
              onTrack={onTrack}
              onBooking={onBooking}
            />
          )}
          {tab === 'planned' && (
            <PlannedList orders={planned} onTrack={onTrack} />
          )}
          {tab === 'history' && (
            <HistoryList orders={history} onDetails={setDetailsOrder} />
          )}
          {tab === 'subscription' && (
            <SubscriptionSection
              userId={userId}
              subscription={subscription}
              usages={usages}
              showPlans={showPlans}
              onShowPlans={() => setShowPlans(true)}
              onBackFromPlans={() => setShowPlans(false)}
              walletBalance={walletBalance}
            />
          )}
        </>
      )}

      {/* Détail d'une commande (historique) — composant partagé OrderHistory */}
      <Dialog
        open={detailsOrder !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsOrder(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          <VisuallyHidden>
            <DialogTitle>Détails de la commande</DialogTitle>
          </VisuallyHidden>
          {detailsOrder && (
            <OrderDetails
              order={detailsOrder}
              onClose={() => setDetailsOrder(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------
// Icône de service (même vocabulaire visuel que le reste de l'app)
// ---------------------------------------------------------------------

function ServiceIcon({ category }: { category?: string | null }) {
  return (
    <div className="w-11 h-11 rounded-[14px] bg-brand-soft grid place-items-center flex-shrink-0">
      {category === 'basic' ? (
        <Zap className="w-5 h-5 text-brand" />
      ) : category === 'premium' ? (
        <Sparkles className="w-5 h-5 text-brand" />
      ) : category === 'deluxe' ? (
        <Crown className="w-5 h-5 text-brand" />
      ) : (
        <Droplets className="w-5 h-5 text-brand" />
      )}
    </div>
  );
}

/** Montant de la carte : 👑 séance abonnement ou prix en F. */
function OrderPrice({ order }: { order: Order }) {
  if (order.isSubscriptionOrder) {
    return (
      <span className="inline-block text-[11px] font-bold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5 whitespace-nowrap">
        👑 Séance
      </span>
    );
  }
  return (
    <>
      <span className="text-body font-bold text-ink whitespace-nowrap">
        {formatPrice(order.totalPrice)}
      </span>
      {order.discount > 0 && (
        <span className="block text-[11px] text-green-600">
          -{formatPrice(order.discount)}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Segment 1 — Activités en cours (lavages immédiats actifs)
// ---------------------------------------------------------------------

function OngoingList({
  orders,
  onTrack,
  onBooking,
}: {
  orders: Order[];
  onTrack: (order: Order) => void;
  onBooking: () => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        message="Aucun lavage en cours — réservez un laveur en quelques gestes."
        actionLabel="Réserver un lavage"
        onAction={onBooking}
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-detail text-soft">
        {orders.length} lavage{orders.length > 1 ? 's' : ''} en cours
      </p>
      {orders.map((order) => {
        const meta = STATUS_META[order.status];
        return (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ServiceIcon category={order.service?.category} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-body font-bold text-ink truncate max-w-full">
                      {order.service?.name}
                    </h3>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-detail text-soft truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {order.address}
                  </p>
                  {order.washer?.user?.name && (
                    <p className="text-detail text-soft mt-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 flex-shrink-0" />
                      {order.washer.user.name}
                      {typeof order.washer?.rating === 'number' && order.washer.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                          {order.washer.rating.toFixed(1)}
                        </span>
                      )}
                    </p>
                  )}
                  {order.status === 'PENDING' && (
                    <p className="text-[11px] text-soft mt-1 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-brand flex-shrink-0" />
                      Nous cherchons le laveur le plus proche…
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <OrderPrice order={order} />
                </div>
              </div>

              <Button
                onClick={() => onTrack(order)}
                className="w-full mt-3 h-10 text-detail font-bold bg-ink hover:bg-ink-2 text-white rounded-btn"
              >
                Suivre en direct
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Segment 2 — Réservations planifiées
// ---------------------------------------------------------------------

function PlannedList({
  orders,
  onTrack,
}: {
  orders: Order[];
  onTrack: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="Aucune réservation planifiée — choisissez « Plus tard » lors de votre prochaine réservation."
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-detail text-soft">
        {orders.length} rendez-vous{orders.length > 1 ? '' : ''} planifié
        {orders.length > 1 ? 's' : ''}
      </p>
      {orders.map((order) => {
        const confirmed = order.status !== 'PENDING';
        const scheduledLabel = formatScheduledLong(order.scheduledAt);
        return (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ServiceIcon category={order.service?.category} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-body font-bold text-ink truncate max-w-full">
                      {order.service?.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        confirmed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {confirmed ? (
                        <>
                          <BadgeCheck className="w-3 h-3" /> Rendez-vous confirmé
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> En attente d&apos;un laveur
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-detail text-soft truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {order.address}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <OrderPrice order={order} />
                </div>
              </div>

              {/* Bloc rendez-vous : date complète + rappel H-2h annoncé */}
              {scheduledLabel && (
                <div className="mt-3 rounded-[14px] bg-[#FFF8E8] border border-[#FFE0B2] p-3">
                  <div className="flex items-start gap-2">
                    <CalendarClock className="w-4 h-4 text-[#E65100] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-detail font-bold text-[#E65100]">
                        {confirmed && order.washer?.user?.name
                          ? `${order.washer.user.name} passera ${scheduledLabel}`
                          : `Rendez-vous demandé ${scheduledLabel}`}
                      </p>
                      <p className="text-[11px] text-soft mt-0.5 flex items-center gap-1">
                        <Bell className="w-3 h-3 flex-shrink-0" />
                        Rappel automatique envoyé 2 h avant le rendez-vous
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => onTrack(order)}
                className="w-full mt-3 h-10 text-detail font-bold bg-ink hover:bg-ink-2 text-white rounded-btn"
              >
                Voir le suivi
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Segment 3 — Historique
// ---------------------------------------------------------------------

function HistoryList({
  orders,
  onDetails,
}: {
  orders: Order[];
  onDetails: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        message="Aucune commande passée — votre historique apparaîtra ici."
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-detail text-soft">
        {orders.length} commande{orders.length > 1 ? 's' : ''} terminée
        {orders.length > 1 ? 's' : ''} ou annulée{orders.length > 1 ? 's' : ''}
      </p>
      {orders.map((order) => {
        const meta = STATUS_META[order.status];
        return (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-0">
              <button
                onClick={() => onDetails(order)}
                className="w-full flex items-start gap-3 p-4 text-left active:bg-brand-soft/40 transition-colors"
                aria-label={`Détails de la commande ${order.orderNumber}`}
              >
                <ServiceIcon category={order.service?.category} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-body font-bold text-ink truncate max-w-full">
                      {order.service?.name}
                    </h3>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-detail text-soft truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {order.address}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-soft">
                      {new Date(order.completedAt || order.createdAt).toLocaleDateString(
                        'fr-FR',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                    {order.scheduledAt && <ScheduledBadge scheduledAt={order.scheduledAt} />}
                    {order.status === 'COMPLETED' && order.review && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-soft">
                        <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                        {order.review.rating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <OrderPrice order={order} />
                </div>
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Segment 4 — Abonnement (progression + étapes des séances)
// ---------------------------------------------------------------------

const USAGE_META: Record<ActivityUsage['status'], { label: string; badge: string; dot: string }> = {
  PENDING: {
    label: 'Réservée — validation en attente',
    badge: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-500',
  },
  VALIDATED: {
    label: 'Séance validée',
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Annulée',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-400',
  },
};

const DURATION_LABELS: Record<string, string> = {
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

function SubscriptionSection({
  userId,
  subscription,
  usages,
  showPlans,
  onShowPlans,
  onBackFromPlans,
  walletBalance,
}: {
  userId: string;
  subscription: ActivitySubscription | null;
  usages: ActivityUsage[];
  showPlans: boolean;
  onShowPlans: () => void;
  onBackFromPlans: () => void;
  walletBalance: number;
}) {
  // Vue « formules » : le panneau d'abonnement complet (achat / renouvellement)
  if (showPlans) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBackFromPlans}
          className="flex items-center gap-1.5 text-detail font-semibold text-soft hover:text-ink transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à mon abonnement
        </button>
        <SubscriptionPanel userId={userId} walletBalance={walletBalance} />
      </div>
    );
  }

  // Aucun abonnement actif → invitation à découvrir les formules
  if (!subscription) {
    return (
      <EmptyState
        icon={Crown}
        message="Aucun abonnement actif — souscrivez une formule et lavez votre voiture à prix fixe, séance après séance."
        actionLabel="Découvrir les formules"
        onAction={onShowPlans}
      />
    );
  }

  const plan = subscription.plan;
  const planName = plan.displayName || plan.name;
  const total = subscription.totalWashes || 0;
  const used = Math.min(subscription.usedWashes || 0, total);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / 86_400_000)
  );

  return (
    <div className="space-y-4">
      {/* Carte « Mon abonnement » : progression des séances */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <img
              src={planPriorityImage(plan.priority ?? 0)}
              alt={`Formule ${planName}`}
              className="w-16 h-16 rounded-[14px] object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-body font-bold text-ink truncate">{planName}</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                  <BadgeCheck className="w-3 h-3" /> Actif
                </span>
              </div>
              <p className="text-detail text-soft mt-0.5">
                {DURATION_LABELS[subscription.duration] ?? subscription.duration} ·{' '}
                {formatPrice(subscription.paidAmount)} payés
                {plan.service?.name ? ` · ${plan.service.name}` : ''}
              </p>
              <p className="text-[11px] text-soft mt-0.5">
                Valable encore {daysLeft} jour{daysLeft > 1 ? 's' : ''} (jusqu&apos;au{' '}
                {new Date(subscription.endDate).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                })}
                )
              </p>
            </div>
          </div>

          {/* Progression des séances */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-detail font-semibold text-ink mb-1.5">
              <span>
                {used}/{total} séance{total > 1 ? 's' : ''} utilisée{used > 1 ? 's' : ''}
              </span>
              <span className="text-brand">{subscription.remainingWashes} restante{subscription.remainingWashes > 1 ? 's' : ''}</span>
            </div>
            <div className="h-2.5 bg-line rounded-full overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={total}>
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            {subscription.freeOptionsTotal > 0 && (
              <p className="text-[11px] text-soft mt-2">
                🎁 Options gratuites : {subscription.freeOptionsUsed}/{subscription.freeOptionsTotal} utilisées
              </p>
            )}
          </div>

          <Button
            onClick={onShowPlans}
            variant="outline"
            className="w-full mt-4 h-10 text-detail font-bold border-line text-ink hover:bg-brand-soft/50"
          >
            Voir les formules
          </Button>
        </CardContent>
      </Card>

      {/* Étapes de l'abonnement : les séances, de la plus récente */}
      <div>
        <h4 className="text-body font-bold text-ink mb-2">Séances de l&apos;abonnement</h4>
        {usages.length === 0 ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-detail text-soft flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" />
                Aucune séance utilisée pour le moment — réservez votre premier
                lavage, il sera déduit de la formule.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <ol className="relative max-h-96 overflow-y-auto">
                {usages.map((usage, index) => {
                  const meta = USAGE_META[usage.status] ?? USAGE_META.PENDING;
                  const isBonus = usage.washType === 'bonus';
                  return (
                    <li key={usage.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {/* Point + ligne de la timeline */}
                      {index < usages.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-line"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative z-10 w-4 h-4 rounded-full ${meta.dot} mt-1 flex-shrink-0 ring-4 ring-white`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-detail font-bold text-ink truncate">
                            {usage.serviceName}
                          </p>
                          {isBonus && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 rounded-full px-1.5 py-0.5">
                              Bonus
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-soft mt-0.5">
                          {new Date(usage.usedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {usage.address ? ` · ${usage.address}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {subscription.remainingWashes > 0 && (
                <div className="flex gap-3 mt-1 pt-3 border-t border-dashed border-line">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-full border-2 border-dashed border-soft/50 bg-transparent mt-1 flex-shrink-0"
                  />
                  <p className="text-detail text-soft">
                    {subscription.remainingWashes} séance
                    {subscription.remainingWashes > 1 ? 's' : ''} à venir — réservez
                    quand vous voulez depuis l&apos;accueil.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
