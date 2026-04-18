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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header with Back Button */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-1">
          <ArrowLeft className="w-5 h-5 text-[#212121]" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-[#212121]">Suivi de commande</h1>
          <p className="text-xs text-[#757575]">{order.orderNumber}</p>
        </div>
      </div>
      
      {/* Map Placeholder */}
      <div className="h-64 bg-gradient-to-br from-blue-100 to-green-100 relative">
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

      {/* Progress */}
      <div className="bg-white p-4 border-b">
        <Progress value={config.progress} className="h-2" />
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Commande</span>
          <span>Acceptée</span>
          <span>En route</span>
          <span>Arrivé</span>
          <span>En cours</span>
        </div>
      </div>

      {/* Order Details */}
      <div className="p-4 space-y-4">
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
        <div className="fixed bottom-4 left-4 right-4">
          <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
            Annuler la commande
          </Button>
        </div>
      )}
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Merci!</h2>
            <p className="text-gray-600 mb-4">
              Votre avis a été enregistré. À bientôt sur WashGo!
            </p>
            <Button onClick={onGoHome} className="bg-[#FF9800] hover:bg-[#F57C00]">
              <Home className="w-4 h-4 mr-2" />
              Retour à l&apos;accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        {/* Back Button */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-[#757575] mb-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>
        )}
        
        {/* Success Card */}
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Lavage terminé!</h2>
            <p className="text-gray-600">
              Votre véhicule est propre et brillant.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Total payé</div>
              <div className="text-2xl font-bold text-blue-600">
                {order.totalPrice.toLocaleString()} FCFA
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Card */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 text-center">Notez votre expérience</h3>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
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
              className="w-full p-3 border rounded-lg resize-none h-24 mb-4"
            />

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmitReview}
              disabled={rating === 0}
            >
              Envoyer mon avis
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
