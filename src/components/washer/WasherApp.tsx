'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useOrdersStore, useWashersStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Power, MapPin, Clock, Star, DollarSign, CheckCircle, 
  X, Navigation, Phone, MessageCircle, Car, AlertCircle,
  Wallet, TrendingUp, Calendar
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

export function WasherApp() {
  const { user, washer } = useAuthStore();
  const { orders, setCurrentOrder } = useOrdersStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAvailable, setIsAvailable] = useState(washer?.isAvailable ?? true);
  const [newOrderRequest, setNewOrderRequest] = useState<Order | null>(null);

  // Demo washer profile
  const washerProfile = {
    name: user?.name || 'Mamadou Diop',
    rating: 4.9,
    totalRatings: 234,
    completedJobs: 156,
    totalEarnings: 156000,
    todayEarnings: 15000,
    todayJobs: 5,
  };

  // Demo pending orders for washer
  const pendingOrders: Order[] = [
    {
      id: 'po1',
      orderNumber: 'WG98765432',
      clientId: 'c1',
      client: { id: 'c1', phone: '771111111', name: 'Amadou Fall', role: 'CLIENT', isActive: true, createdAt: '', updatedAt: '' },
      serviceId: '2',
      service: { id: '2', name: 'Lavage Complet', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
      isHomeService: true,
      address: 'Plateau, Dakar - 1.2 km',
      latitude: 14.694,
      longitude: -17.443,
      basePrice: 10000,
      discount: 0,
      totalPrice: 10000,
      commission: 1500,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Simulate incoming order request
  useEffect(() => {
    if (isAvailable && !newOrderRequest && pendingOrders.length > 0) {
      const timer = setTimeout(() => {
        setNewOrderRequest(pendingOrders[0]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAvailable, newOrderRequest]);

  const handleAcceptOrder = () => {
    if (newOrderRequest) {
      setCurrentOrder({ ...newOrderRequest, status: 'ACCEPTED' });
      setNewOrderRequest(null);
      setActiveTab('active');
    }
  };

  const handleRejectOrder = () => {
    setNewOrderRequest(null);
  };

  return (
    <div className="pb-20">
      {/* Availability Toggle */}
      <div className="bg-white border-b px-4 py-3 sticky top-16 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-gradient-to-br from-green-400 to-blue-400 text-white">
                {washerProfile.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{washerProfile.name}</div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm">{washerProfile.rating}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Disponibilité</div>
              <div className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-400'}`}>
                {isAvailable ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
              className={isAvailable ? 'bg-green-600' : ''}
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <WasherDashboard profile={washerProfile} isAvailable={isAvailable} />
      )}
      {activeTab === 'active' && <ActiveOrderView />}
      {activeTab === 'history' && <WasherOrderHistory />}
      {activeTab === 'earnings' && <WasherEarnings profile={washerProfile} />}

      {/* New Order Request Modal */}
      {newOrderRequest && (
        <NewOrderModal
          order={newOrderRequest}
          onAccept={handleAcceptOrder}
          onReject={handleRejectOrder}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
        <div className="flex justify-around py-2">
          {[
            { id: 'dashboard', icon: Power, label: 'Accueil' },
            { id: 'active', icon: Car, label: 'Active' },
            { id: 'history', icon: Clock, label: 'Historique' },
            { id: 'earnings', icon: Wallet, label: 'Revenus' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Washer Dashboard Component
function WasherDashboard({ profile, isAvailable }: { profile: any; isAvailable: boolean }) {
  return (
    <div className="p-4 space-y-4">
      {/* Status Banner */}
      {!isAvailable && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Vous êtes hors ligne</p>
            <p className="text-sm text-yellow-700">
              Activez votre disponibilité pour recevoir des commandes.
            </p>
          </div>
        </div>
      )}

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aujourd&apos;hui</p>
                <p className="text-xl font-bold text-green-600">
                  {profile.todayEarnings.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Car className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Lavages</p>
                <p className="text-xl font-bold text-blue-600">{profile.todayJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Votre note</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-bold">{profile.rating}</span>
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Basé sur {profile.totalRatings} avis
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total lavages</p>
              <p className="text-2xl font-bold">{profile.completedJobs}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Orders */}
      <div>
        <h2 className="font-semibold mb-3">Commandes en attente</h2>
        {isAvailable ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <p className="text-blue-800 font-medium">En attente de commandes...</p>
            <p className="text-sm text-blue-600 mt-1">
              Vous serez notifié dès qu&apos;une commande arrive.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-gray-500">Activez votre disponibilité pour voir les commandes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Active Order View
function ActiveOrderView() {
  const { currentOrder, updateOrder, setCurrentOrder } = useOrdersStore();
  const [activeStep, setActiveStep] = useState(0);

  // Demo active order
  const activeOrder: Order = currentOrder || {
    id: 'active1',
    orderNumber: 'WG12345678',
    clientId: 'c1',
    client: { id: 'c1', phone: '771111111', name: 'Amadou Fall', role: 'CLIENT', isActive: true, createdAt: '', updatedAt: '' },
    serviceId: '2',
    service: { id: '2', name: 'Lavage Complet', price: 10000, duration: 45, category: 'standard', isActive: true, createdAt: '', updatedAt: '' },
    isHomeService: true,
    address: 'Plateau, Dakar',
    latitude: 14.694,
    longitude: -17.443,
    basePrice: 10000,
    discount: 0,
    totalPrice: 10000,
    commission: 1500,
    status: 'ACCEPTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const steps = [
    { status: 'ACCEPTED', label: 'Acceptée', icon: CheckCircle },
    { status: 'EN_ROUTE', label: 'En route', icon: Navigation },
    { status: 'ARRIVED', label: 'Arrivé', icon: MapPin },
    { status: 'IN_PROGRESS', label: 'En cours', icon: Car },
    { status: 'COMPLETED', label: 'Terminée', icon: CheckCircle },
  ];

  const handleUpdateStatus = (newStatus: OrderStatus) => {
    updateOrder({ id: activeOrder.id, status: newStatus });
    if (newStatus === 'COMPLETED') {
      // Show completion screen
    }
  };

  const currentStepIndex = steps.findIndex(s => s.status === activeOrder.status);

  if (!currentOrder) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune commande active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={step.status} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index <= currentStepIndex
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <span className={`text-xs mt-1 ${index <= currentStepIndex ? 'text-green-600' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {activeOrder.client.name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{activeOrder.client.name}</h3>
              <p className="text-sm text-gray-500">{activeOrder.client.phone}</p>
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

      {/* Service & Location */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-sm text-gray-500">Service</p>
            <p className="font-medium">{activeOrder.service.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Adresse</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <p className="font-medium">{activeOrder.address}</p>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-500">Vos gains</span>
            <span className="font-bold text-green-600">
              {(activeOrder.totalPrice - activeOrder.commission).toLocaleString()} FCFA
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {activeOrder.status === 'ACCEPTED' && (
          <Button
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            onClick={() => handleUpdateStatus('EN_ROUTE')}
          >
            <Navigation className="w-5 h-5 mr-2" />
            Démarrer le trajet
          </Button>
        )}

        {activeOrder.status === 'EN_ROUTE' && (
          <Button
            className="w-full h-12 bg-green-600 hover:bg-green-700"
            onClick={() => handleUpdateStatus('ARRIVED')}
          >
            <MapPin className="w-5 h-5 mr-2" />
            Je suis arrivé
          </Button>
        )}

        {activeOrder.status === 'ARRIVED' && (
          <Button
            className="w-full h-12 bg-purple-600 hover:bg-purple-700"
            onClick={() => handleUpdateStatus('IN_PROGRESS')}
          >
            <Car className="w-5 h-5 mr-2" />
            Commencer le lavage
          </Button>
        )}

        {activeOrder.status === 'IN_PROGRESS' && (
          <Button
            className="w-full h-12 bg-green-600 hover:bg-green-700"
            onClick={() => handleUpdateStatus('COMPLETED')}
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
function WasherOrderHistory() {
  // Demo history
  const history = [
    { id: '1', client: 'Amadou Fall', service: 'Lavage Express', amount: 5000, date: 'Aujourd\'hui, 14:30', rating: 5 },
    { id: '2', client: 'Fatou Sow', service: 'Lavage Complet', amount: 10000, date: 'Aujourd\'hui, 10:15', rating: 4 },
    { id: '3', client: 'Ibrahima Diallo', service: 'Lavage Premium', amount: 15000, date: 'Hier, 16:45', rating: 5 },
  ];

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-lg">Historique des lavages</h2>
      
      {history.map((order) => (
        <Card key={order.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{order.client}</h3>
                <p className="text-sm text-gray-500">{order.service}</p>
                <p className="text-xs text-gray-400 mt-1">{order.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">{order.amount.toLocaleString()} FCFA</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < order.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Washer Earnings
function WasherEarnings({ profile }: { profile: any }) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Revenus</h2>

      {/* Total Earnings */}
      <Card className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Total des gains</p>
          <p className="text-3xl font-bold mt-1">{profile.totalEarnings.toLocaleString()} FCFA</p>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+15% ce mois</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Cette semaine</p>
            <p className="text-xl font-bold">45 000 FCFA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Ce mois</p>
            <p className="text-xl font-bold">156 000 FCFA</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Solde disponible</p>
              <p className="text-xl font-bold text-green-600">{profile.totalEarnings.toLocaleString()} FCFA</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700">
              Retirer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// New Order Modal
function NewOrderModal({ order, onAccept, onReject }: { order: Order; onAccept: () => void; onReject: () => void }) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onReject]);

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-blue-600" />
            </div>
            Nouvelle commande!
          </DialogTitle>
          <DialogDescription className="text-center">
            <Badge variant="outline" className="text-lg">
              {timeLeft}s restantes
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{order.service.name}</span>
              <span className="font-bold text-blue-600">{order.totalPrice.toLocaleString()} FCFA</span>
            </div>
            <div className="text-sm text-gray-500">{order.service.duration} minutes</div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-medium">{order.client.name}</p>
              <p className="text-sm text-gray-500">{order.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-500">Vos gains</p>
              <p className="font-bold text-green-600">
                {(order.totalPrice - order.commission).toLocaleString()} FCFA
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onReject} className="flex-1 border-red-200 text-red-600">
            <X className="w-4 h-4 mr-2" />
            Refuser
          </Button>
          <Button onClick={onAccept} className="flex-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Accepter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
