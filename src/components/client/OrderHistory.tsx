'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock, CheckCircle, X, ChevronRight, Star, Zap, Droplets, Sparkles, Crown,
  MapPin, User, Car, Calendar, CreditCard, Phone, MessageCircle, RefreshCw,
  Loader2, ArrowLeft, Copy, ExternalLink
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { toast } from 'sonner';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  EN_ROUTE: 'En route',
  ARRIVED: 'Arrivé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  EN_ROUTE: 'bg-blue-100 text-blue-800',
  ARRIVED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MOBILE_MONEY: 'Mobile Money',
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600',
  COMPLETED: 'text-green-600',
  FAILED: 'text-red-600',
  REFUNDED: 'text-blue-600',
};

export function OrderHistory() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(`/api/orders?userId=${user.id}&role=CLIENT`);
        const data = await res.json();
        
        if (data.success && data.orders) {
          setOrders(data.orders);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [user?.id]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(order.status);
    if (activeTab === 'completed') return order.status === 'COMPLETED';
    return true;
  });

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-[#E0E0E0] flex-shrink-0">
        <h1 className="text-xl font-bold text-[#212121]">Historique</h1>
        <p className="text-sm text-[#757575]">Vos commandes passées</p>
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 py-2 flex gap-2 border-b border-[#E0E0E0] flex-shrink-0">
        {[
          { id: 'all', label: 'Tous' },
          { id: 'active', label: 'En cours' },
          { id: 'completed', label: 'Terminés' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#FF9800] text-white'
                : 'bg-[#F5F5F5] text-[#757575]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-28">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF9800]" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-[#BDBDBD] mx-auto mb-3" />
            <p className="text-[#757575]">Aucune commande</p>
            <p className="text-sm text-[#9E9E9E] mt-1">Vos commandes apparaîtront ici</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onViewDetails={() => handleViewDetails(order)}
            />
          ))
        )}
      </div>

      {/* Order Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          {selectedOrder && (
            <OrderDetails 
              order={selectedOrder} 
              onClose={() => setShowDetails(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: () => void }) {
  return (
    <Card className="overflow-hidden shadow-sm border-0">
      <CardContent className="p-0">
        <button
          onClick={onViewDetails}
          className="w-full flex items-center gap-4 p-4 text-left"
        >
          {/* Service Icon */}
          <div className="w-14 h-14 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
            {order.service.category === 'basic' && <Zap className="w-6 h-6 text-[#FF9800]" />}
            {order.service.category === 'standard' && <Droplets className="w-6 h-6 text-[#FF9800]" />}
            {order.service.category === 'premium' && <Sparkles className="w-6 h-6 text-[#FF9800]" />}
            {order.service.category === 'deluxe' && <Crown className="w-6 h-6 text-[#FF9800]" />}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-[#212121] truncate">{order.service.name}</h3>
              <Badge className={STATUS_COLORS[order.status]}>
                {STATUS_LABELS[order.status]}
              </Badge>
            </div>
            <p className="text-sm text-[#757575] truncate">{order.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#9E9E9E]">
                {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {order.status === 'COMPLETED' && order.review && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                  <span className="text-xs text-[#757575]">{order.review.rating}</span>
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-[#FF9800]">
              {order.totalPrice.toLocaleString()} F
            </div>
            {order.discount > 0 && (
              <div className="text-xs text-green-600">
                -{order.discount.toLocaleString()} F
              </div>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-[#BDBDBD] flex-shrink-0" />
        </button>

        {order.status === 'COMPLETED' && !order.review && (
          <div className="px-4 pb-4">
            <Button variant="outline" className="w-full border-[#FF9800] text-[#FF9800]">
              <Star className="w-4 h-4 mr-2" />
              Laisser un avis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    toast.success('Numéro copié !');
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm opacity-80">Commande</span>
          <Badge className="bg-white/20 text-white">
            {STATUS_LABELS[order.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">{order.orderNumber}</span>
          <button onClick={copyOrderNumber} className="p-1 hover:bg-white/20 rounded">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-sm opacity-80">
          {formatDate(order.createdAt)}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Service */}
        <div className="bg-[#FFF8F0] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FF9800] rounded-lg flex items-center justify-center">
              {order.service.category === 'basic' && <Zap className="w-6 h-6 text-white" />}
              {order.service.category === 'standard' && <Droplets className="w-6 h-6 text-white" />}
              {order.service.category === 'premium' && <Sparkles className="w-6 h-6 text-white" />}
              {order.service.category === 'deluxe' && <Crown className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#212121]">{order.service.name}</h3>
              <p className="text-sm text-[#757575]">{order.service.duration} min</p>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#FF9800] text-lg">
                {order.totalPrice.toLocaleString()} F
              </div>
              {order.discount > 0 && (
                <div className="text-xs text-green-600">
                  Réduction: -{order.discount.toLocaleString()} F
                </div>
              )}
            </div>
          </div>
          {order.service.description && (
            <p className="text-sm text-[#757575] mt-2">{order.service.description}</p>
          )}
        </div>

        {/* Location */}
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-[#757575]">Adresse</p>
              <p className="font-medium text-[#212121]">{order.address}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  order.isHomeService 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {order.isHomeService ? 'À domicile' : 'En station'}
                </span>
              </div>
            </div>
            {order.latitude && order.longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-[#F5F5F5] rounded-lg"
              >
                <ExternalLink className="w-5 h-5 text-[#757575]" />
              </a>
            )}
          </div>
        </div>

        {/* Washer */}
        {order.washer && (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#757575]">Laveur</p>
                <p className="font-medium text-[#212121]">{order.washer.user.name || 'Non assigné'}</p>
                {order.washer.rating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-[#FFC107] fill-[#FFC107]" />
                    <span className="text-xs text-[#757575]">{order.washer.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <a
                href={`tel:${order.washer.user.phone}`}
                className="p-2 bg-[#FFF3E0] rounded-lg"
              >
                <Phone className="w-5 h-5 text-[#FF9800]" />
              </a>
            </div>
          </div>
        )}

        {/* Vehicle */}
        {(order.vehiclePlate || order.vehicleColor) && (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FCE4EC] rounded-full flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-[#E91E63]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#757575]">Véhicule</p>
                <div className="flex items-center gap-2">
                  {order.vehiclePlate && (
                    <span className="font-medium text-[#212121]">{order.vehiclePlate}</span>
                  )}
                  {order.vehicleColor && (
                    <span className="text-sm text-[#757575]">• {order.vehicleColor}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment */}
        {order.payment && (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFF8E1] rounded-full flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-[#FFC107]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#757575]">Paiement</p>
                <p className="font-medium text-[#212121]">
                  {PAYMENT_METHOD_LABELS[order.payment.method] || order.payment.method}
                </p>
                {order.payment.transactionId && (
                  <p className="text-xs text-[#9E9E9E]">ID: {order.payment.transactionId}</p>
                )}
              </div>
              <span className={`text-sm font-medium ${PAYMENT_STATUS_COLORS[order.payment.status]}`}>
                {order.payment.status === 'COMPLETED' ? 'Payé' : order.payment.status}
              </span>
            </div>
          </div>
        )}

        {/* Promo Code */}
        {order.promoCode && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-green-600">Code promo utilisé</p>
                <p className="font-bold text-green-700">{order.promoCode}</p>
              </div>
              <span className="text-green-600 font-medium">
                -{order.discount.toLocaleString()} F
              </span>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
          <h4 className="font-semibold text-[#212121] mb-3">Chronologie</h4>
          <div className="space-y-3">
            <TimelineItem
              label="Commande créée"
              date={order.createdAt}
              completed
            />
            {order.acceptedAt && (
              <TimelineItem
                label="Acceptée par le laveur"
                date={order.acceptedAt}
                completed
              />
            )}
            {order.arrivedAt && (
              <TimelineItem
                label="Laveur arrivé"
                date={order.arrivedAt}
                completed
              />
            )}
            {order.startedAt && (
              <TimelineItem
                label="Lavage commencé"
                date={order.startedAt}
                completed
              />
            )}
            {order.completedAt && (
              <TimelineItem
                label="Lavage terminé"
                date={order.completedAt}
                completed
              />
            )}
            {order.cancelledAt && (
              <TimelineItem
                label="Commande annulée"
                date={order.cancelledAt}
                completed
                isCancel
                cancelReason={order.cancelReason}
              />
            )}
          </div>
        </div>

        {/* Review */}
        {order.review && (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
            <h4 className="font-semibold text-[#212121] mb-2">Votre avis</h4>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= order.review!.rating
                      ? 'text-[#FFC107] fill-[#FFC107]'
                      : 'text-[#E0E0E0]'
                  }`}
                />
              ))}
            </div>
            {order.review.comment && (
              <p className="text-sm text-[#757575] italic">"{order.review.comment}"</p>
            )}
          </div>
        )}

        {/* Price Summary */}
        <div className="bg-[#FAFAFA] rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#757575]">Sous-total</span>
            <span className="text-[#212121]">{order.basePrice.toLocaleString()} F</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Réduction</span>
              <span className="text-green-600">-{order.discount.toLocaleString()} F</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t border-[#E0E0E0]">
            <span className="text-[#212121]">Total</span>
            <span className="text-[#FF9800]">{order.totalPrice.toLocaleString()} F</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-[#E0E0E0] space-y-2">
        {order.status === 'COMPLETED' && !order.review && (
          <Button className="w-full bg-[#FF9800] hover:bg-[#F57C00]">
            <Star className="w-4 h-4 mr-2" />
            Laisser un avis
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

function TimelineItem({ 
  label, 
  date, 
  completed, 
  isCancel,
  cancelReason 
}: { 
  label: string; 
  date: string; 
  completed: boolean;
  isCancel?: boolean;
  cancelReason?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${
          isCancel 
            ? 'bg-red-500' 
            : completed 
              ? 'bg-green-500' 
              : 'bg-[#BDBDBD]'
        }`} />
        <div className="w-0.5 h-6 bg-[#E0E0E0]" />
      </div>
      <div className="flex-1 pb-2">
        <p className={`text-sm font-medium ${isCancel ? 'text-red-600' : 'text-[#212121]'}`}>
          {label}
        </p>
        <p className="text-xs text-[#757575]">
          {new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        {cancelReason && (
          <p className="text-xs text-red-500 mt-1">{cancelReason}</p>
        )}
      </div>
    </div>
  );
}
