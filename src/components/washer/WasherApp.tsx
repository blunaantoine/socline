'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore, useOrdersStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Power, MapPin, Clock, Star, DollarSign, CheckCircle, 
  Navigation, Phone, MessageCircle, Car, AlertCircle,
  Wallet, TrendingUp, Calendar, LogOut, Settings, Home,
  RefreshCw, Loader2, ArrowLeft
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

export function WasherApp() {
  const { user, logout } = useAuthStore();
  const { currentOrder, setCurrentOrder, orders, setOrders } = useOrdersStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

  // Get washer stats from user or defaults
  const washerStats = {
    name: user?.name || 'Laveur',
    rating: 0,
    totalRatings: 0,
    completedJobs: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    todayJobs: 0,
  };

  // Fetch pending orders
  const fetchPendingOrders = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?userId=${user.id}&role=WASHER&status=PENDING`);
      const data = await res.json();
      
      if (data.success) {
        setPendingOrders(data.orders);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch my orders (active and history)
  const fetchMyOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const res = await fetch(`/api/orders?userId=${user.id}&role=WASHER`);
      const data = await res.json();
      
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
    
    // Poll for new orders every 10 seconds when available
    const interval = setInterval(() => {
      if (isAvailable) {
        fetchPendingOrders();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isAvailable, fetchPendingOrders, fetchMyOrders]);

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

      const data = await res.json();

      if (data.success) {
        setCurrentOrder(data.order);
        setPendingOrders(prev => prev.filter(o => o.id !== order.id));
        setActiveTab('active');
      }
    } catch (error) {
      console.error('Accept order error:', error);
    }
  };

  // Update order status
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!currentOrder) return;
    
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder.id,
          status: newStatus,
        }),
      });

      const data = await res.json();

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

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0] overflow-hidden">
      {/* iOS Status Bar */}
      <div className="h-11 bg-transparent flex items-end justify-between px-6 pb-1 flex-shrink-0 absolute top-0 left-0 right-0 z-50">
        <span className="text-sm font-semibold text-[#212121]">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 flex items-end justify-between">
            <div className="w-0.5 h-1.5 bg-[#212121] rounded-sm"></div>
            <div className="w-0.5 h-2.5 bg-[#212121] rounded-sm"></div>
            <div className="w-0.5 h-3.5 bg-[#212121] rounded-sm"></div>
            <div className="w-0.5 h-4 bg-[#212121] rounded-sm"></div>
          </div>
          <div className="w-6 h-3 border border-[#212121] rounded-sm relative">
            <div className="absolute inset-0.5 bg-[#212121] rounded-sm" style={{ width: '80%' }}></div>
          </div>
        </div>
      </div>

      {/* Header with Availability */}
      <div className="bg-white border-b px-4 py-3 pt-12 flex-shrink-0">
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
              onCheckedChange={setIsAvailable}
              className={isAvailable ? 'bg-[#4CAF50]' : ''}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'dashboard' && (
          <WasherDashboard 
            stats={washerStats} 
            isAvailable={isAvailable} 
            isLoading={isLoading}
            pendingOrders={pendingOrders}
            onAccept={handleAcceptOrder}
            onRefresh={fetchPendingOrders}
          />
        )}
        {activeTab === 'active' && (
          <ActiveOrderView 
            order={currentOrder} 
            onUpdateStatus={handleUpdateStatus} 
            onBack={() => setActiveTab('dashboard')}
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
          />
        )}
        {activeTab === 'profile' && (
          <WasherProfile 
            user={user} 
            stats={washerStats} 
            onLogout={logout} 
            onBack={() => setActiveTab('dashboard')}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#F5F5F5] flex justify-around items-center py-2 px-2 z-50">
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
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'
              }`}
            >
              <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'bg-[#E8F5E9] rounded-lg' : ''}`}>
                <tab.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Home Indicator */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
    </div>
  );
}

// Washer Dashboard
function WasherDashboard({ stats, isAvailable, isLoading, pendingOrders, onAccept, onRefresh }: { 
  stats: any; 
  isAvailable: boolean;
  isLoading: boolean;
  pendingOrders: Order[];
  onAccept: (order: Order) => void;
  onRefresh: () => void;
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
                <p className="text-lg font-bold text-[#4CAF50]">
                  {stats.todayEarnings.toLocaleString()} F
                </p>
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
                          <p className="font-bold text-xl">{order.totalPrice?.toLocaleString()} F</p>
                          <p className="text-sm opacity-80">{order.service?.duration || 30} min</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#FF9800]" />
                        <span className="text-sm text-[#212121]">{order.address || 'Adresse non spécifiée'}</span>
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
function ActiveOrderView({ order, onUpdateStatus, onBack }: { 
  order: Order | null; 
  onUpdateStatus: (status: OrderStatus) => void;
  onBack: () => void;
}) {

  const steps = [
    { status: 'ACCEPTED', label: 'Acceptée', icon: CheckCircle },
    { status: 'EN_ROUTE', label: 'En route', icon: Navigation },
    { status: 'ARRIVED', label: 'Arrivé', icon: MapPin },
    { status: 'IN_PROGRESS', label: 'En cours', icon: Car },
    { status: 'COMPLETED', label: 'Terminée', icon: CheckCircle },
  ];

  if (!order) {
    return (
      <div className="p-4">
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#4CAF50] mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </button>
        
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-[#9E9E9E]" />
          </div>
          <p className="font-medium text-[#757575]">Aucune commande active</p>
          <p className="text-sm text-[#9E9E9E] mt-1">
            Les nouvelles commandes apparaîtront ici.
          </p>
        </div>
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

      {/* Progress Steps */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={step.status} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index <= currentStepIndex
                      ? 'bg-[#4CAF50] text-white'
                      : 'bg-[#F5F5F5] text-[#9E9E9E]'
                  }`}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] mt-1 ${index <= currentStepIndex ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <Button size="icon" variant="outline" className="rounded-full">
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
              {((order.totalPrice || 0) - (order.commission || 0)).toLocaleString()} F
            </span>
          </div>
        </CardContent>
      </Card>

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
                      {((order.totalPrice || 0) - (order.commission || 0)).toLocaleString()} F
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
function WasherEarnings({ stats, onBack }: { 
  stats: any;
  onBack: () => void;
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
      
      <h2 className="font-semibold text-lg text-[#212121]">Revenus</h2>

      {/* Total Earnings */}
      <Card className="bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] text-white border-0">
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Total des gains</p>
          <p className="text-3xl font-bold mt-1">{stats.totalEarnings.toLocaleString()} F</p>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Commencez à gagner!</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-[#2196F3] mx-auto mb-2" />
            <p className="text-xs text-[#757575]">Cette semaine</p>
            <p className="text-lg font-bold text-[#212121]">0 F</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-[#4CAF50] mx-auto mb-2" />
            <p className="text-xs text-[#757575]">Ce mois</p>
            <p className="text-lg font-bold text-[#212121]">0 F</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-[#757575]">Solde disponible</p>
              <p className="text-xl font-bold text-[#4CAF50]">{stats.totalEarnings.toLocaleString()} F</p>
            </div>
            <Button className="bg-[#4CAF50] hover:bg-[#43A047] rounded-xl" disabled>
              Retirer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Washer Profile
function WasherProfile({ user, stats, onLogout, onBack }: { 
  user: any; 
  stats: any; 
  onLogout: () => void;
  onBack: () => void;
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
              <div className="text-xl font-bold text-[#2196F3]">{stats.totalEarnings.toLocaleString()}F</div>
              <div className="text-xs text-[#757575]">Gains</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu */}
      <Card className="border-0 shadow-sm overflow-hidden">
        {[
          { icon: Car, label: 'Mes services' },
          { icon: Clock, label: 'Horaires' },
          { icon: Wallet, label: 'Paiements' },
          { icon: Settings, label: 'Paramètres' },
        ].map((item, index) => (
          <button
            key={index}
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
