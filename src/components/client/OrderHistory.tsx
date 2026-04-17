'use client';

import { useState } from 'react';
import { useOrdersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, X, ChevronRight, Star, Zap, Droplets, Sparkles, Crown } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

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

export function OrderHistory() {
  const { orders } = useOrdersStore();
  const [activeTab, setActiveTab] = useState('all');

  // Demo orders
  const demoOrders: Order[] = [
    {
      id: '1',
      orderNumber: 'WG12345678',
      clientId: 'demo',
      client: { id: 'demo', phone: '771234567', name: 'Client', role: 'CLIENT', isActive: true, createdAt: '', updatedAt: '' },
      serviceId: '1',
      service: { id: '1', name: 'Lavage Express', price: 5000, duration: 20, category: 'basic', isActive: true, createdAt: '', updatedAt: '' },
      isHomeService: true,
      address: 'Centre-ville, Lomé',
      basePrice: 5000,
      discount: 0,
      totalPrice: 5000,
      commission: 750,
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '2',
      orderNumber: 'WG12345679',
      clientId: 'demo',
      client: { id: 'demo', phone: '771234567', name: 'Client', role: 'CLIENT', isActive: true, createdAt: '', updatedAt: '' },
      serviceId: '2',
      service: { id: '2', name: 'Lavage Complet', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
      isHomeService: true,
      address: 'Bè, Lomé',
      basePrice: 10000,
      discount: 1000,
      totalPrice: 9000,
      commission: 1350,
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  const allOrders = [...orders, ...demoOrders];

  const filteredOrders = allOrders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(order.status);
    if (activeTab === 'completed') return order.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Historique</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="active">En cours</TabsTrigger>
          <TabsTrigger value="completed">Terminés</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune commande</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Service Icon */}
          <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
            {order.service.category === 'basic' && <Zap className="w-6 h-6 text-emerald-600" />}
            {order.service.category === 'standard' && <Droplets className="w-6 h-6 text-emerald-600" />}
            {order.service.category === 'premium' && <Sparkles className="w-6 h-6 text-emerald-600" />}
            {order.service.category === 'deluxe' && <Crown className="w-6 h-6 text-emerald-600" />}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{order.service.name}</h3>
              <Badge className={STATUS_COLORS[order.status]}>
                {STATUS_LABELS[order.status]}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 truncate">{order.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">
                {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {order.status === 'COMPLETED' && order.review && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs">{order.review.rating}</span>
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="font-bold text-blue-600">
              {order.totalPrice.toLocaleString()} FCFA
            </div>
            {order.discount > 0 && (
              <div className="text-xs text-green-600">
                -{order.discount.toLocaleString()}
              </div>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        {order.status === 'COMPLETED' && !order.review && (
          <div className="px-4 pb-4">
            <Button variant="outline" className="w-full">
              <Star className="w-4 h-4 mr-2" />
              Laisser un avis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
