'use client';

import { useState, useEffect } from 'react';
import { useOrdersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, Phone, MessageCircle, Clock, Star, 
  CheckCircle, Navigation, AlertCircle, X, ArrowLeft, Home
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

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

export function OrderTracking({ order, onBack }: OrderTrackingProps) {
  const { updateOrder, setCurrentOrder } = useOrdersStore();
  const [estimatedTime, setEstimatedTime] = useState(12);
  const [washerLocation, setWasherLocation] = useState({ lat: 14.692, lng: -17.445 });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate washer movement
      if (order.status === 'EN_ROUTE') {
        setWasherLocation(prev => ({
          lat: prev.lat + 0.0001,
          lng: prev.lng + 0.0001,
        }));
        setEstimatedTime(prev => Math.max(1, prev - 1));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [order.status]);

  // Simulate status progression
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    if (order.status === 'PENDING') {
      timers.push(setTimeout(() => updateOrder({ id: order.id, status: 'ACCEPTED' }), 3000));
    }
    if (order.status === 'ACCEPTED') {
      timers.push(setTimeout(() => updateOrder({ id: order.id, status: 'EN_ROUTE' }), 5000));
    }
    if (order.status === 'EN_ROUTE') {
      timers.push(setTimeout(() => updateOrder({ id: order.id, status: 'ARRIVED' }), 15000));
    }
    if (order.status === 'ARRIVED') {
      timers.push(setTimeout(() => updateOrder({ id: order.id, status: 'IN_PROGRESS' }), 5000));
    }
    if (order.status === 'IN_PROGRESS') {
      timers.push(setTimeout(() => updateOrder({ id: order.id, status: 'COMPLETED' }), 30000));
    }

    return () => timers.forEach(t => clearTimeout(t));
  }, [order.status, order.id, updateOrder]);

  const config = STATUS_CONFIG[order.status];
  const StatusIcon = config.icon;

  if (order.status === 'COMPLETED') {
    return <OrderCompleted order={order} onBack={onBack} onGoHome={() => setCurrentOrder(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA]">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
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
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-3 flex items-center gap-3 flex-shrink-0 sticky top-6 z-40">
        <button onClick={onBack} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-[#212121]" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[#212121]">Suivi de commande</h1>
          <p className="text-xs text-[#757575]">{order.orderNumber}</p>
        </div>
      </div>
      
      {/* Map Placeholder */}
      <div className="h-48 bg-gradient-to-br from-blue-100 to-green-100 relative flex-shrink-0">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Navigation className="w-12 h-12 text-blue-600 mx-auto mb-2 animate-bounce" />
            <p className="text-gray-600">Carte en temps réel</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4 right-4">
          <Badge className={`${config.color} text-base px-4 py-2`}>
            <StatusIcon className="w-4 h-4 mr-2" />
            {config.label}
          </Badge>
        </div>

        {/* Estimated Time */}
        {order.status === 'EN_ROUTE' && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg p-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Arrivée estimée</span>
              </div>
              <span className="text-xl font-bold text-blue-600">{estimatedTime} min</span>
            </div>
          </div>
        )}
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
      <div className="flex-1 overflow-y-auto pb-28 p-4 space-y-4">
        {/* Service Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{order.service.name}</h3>
                <p className="text-sm text-gray-500">{order.address}</p>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {order.totalPrice.toLocaleString()} FCFA
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Washer Info */}
        {order.status !== 'PENDING' && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-green-400 text-white text-lg">
                    M
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold">Mamadou Diop</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm">4.9</span>
                    <span className="text-gray-300 mx-1">•</span>
                    <span className="text-sm text-gray-500">156 lavages</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="outline">
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {order.status === 'PENDING' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Recherche d&apos;un laveur</p>
              <p className="text-sm text-yellow-700">
                Nous recherchons un laveur disponible près de vous...
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

      {/* Cancel Button */}
      {['PENDING', 'ACCEPTED'].includes(order.status) && (
        <div className="px-4 pb-4">
          <Button variant="outline" className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50">
            Annuler la commande
          </Button>
        </div>
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

// Order Completed Component
function OrderCompleted({ order, onBack, onGoHome }: { order: Order; onBack?: () => void; onGoHome: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitReview = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col bg-[#FAFAFA]">
        {/* Android Status Bar */}
        <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
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
                Votre avis a été enregistré. À bientôt sur WashGo!
              </p>
              <Button onClick={onGoHome} className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl">
                <Home className="w-4 h-4 mr-2" />
                Retour à l&apos;accueil
              </Button>
            </CardContent>
          </Card>
        </div>
        {/* Android Navigation Bar */}
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

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA]">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
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

      <div className="flex-1 overflow-y-auto pb-28 p-4">
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
                <div className="text-xs text-[#757575]">Total payé</div>
                <div className="text-xl font-bold text-[#FF9800]">
                  {order.totalPrice.toLocaleString()} F
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rating Card */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-center text-[#212121]">Notez votre expérience</h3>
              
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
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
              <Button
                className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl mt-3"
                onClick={handleSubmitReview}
                disabled={rating === 0}
              >
                Envoyer mon avis
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Android Navigation Bar */}
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
