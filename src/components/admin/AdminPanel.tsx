'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LayoutDashboard, Users, Car, MapPin, DollarSign, 
  TrendingUp, Clock, Star, Settings, Bell, Plus,
  CheckCircle, XCircle, AlertCircle, Search,
  ChevronDown, Download, Eye, Edit, Trash2, Tag,
  RefreshCw, Loader2, ArrowLeft, LogOut, Percent, Wallet, Phone, Image as ImageIcon, Move, Banknote
} from 'lucide-react';
import { HideableBalanceLight } from '@/components/ui/hideable-balance';
import { toast } from 'sonner';

// Component to drag and position image
function ImagePositionEditor({ 
  imageSrc, 
  position, 
  onPositionChange, 
  onRemove 
}: { 
  imageSrc: string; 
  position: string; 
  onPositionChange: (pos: string) => void;
  onRemove: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Parse position to get x,y percentages
  const parsePosition = (pos: string): { x: number; y: number } => {
    if (pos.includes('%')) {
      const parts = pos.split(' ').map(p => parseInt(p.replace('%', '')));
      return { y: parts[0] || 50, x: parts[1] || 50 };
    }
    // Handle named positions
    const positions: Record<string, { x: number; y: number }> = {
      'top left': { x: 0, y: 0 },
      'top center': { x: 50, y: 0 },
      'top right': { x: 100, y: 0 },
      'center left': { x: 0, y: 50 },
      'center': { x: 50, y: 50 },
      'center right': { x: 100, y: 50 },
      'bottom left': { x: 0, y: 100 },
      'bottom center': { x: 50, y: 100 },
      'bottom right': { x: 100, y: 100 },
    };
    return positions[pos] || { x: 50, y: 50 };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      onPositionChange(`${Math.round(y)}% ${Math.round(x)}%`);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onPositionChange]);

  const pos = parsePosition(position);

  return (
    <div className="relative w-full h-full">
      {/* Instructions */}
      <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
        <Move className="w-3 h-3" />
        Glissez pour ajuster
      </div>
      
      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 z-10 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
      >
        <XCircle className="w-4 h-4 text-white" />
      </button>
      
      {/* Image container */}
      <div 
        ref={containerRef}
        className="w-full h-full cursor-move overflow-hidden rounded-lg relative"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <img 
          src={imageSrc} 
          alt="Preview" 
          className="w-full h-full object-cover select-none"
          style={{ objectPosition: position }}
          onLoad={() => setIsLoaded(true)}
          draggable={false}
        />
        
        {/* Crosshair indicator */}
        <div 
          className="absolute w-4 h-4 pointer-events-none transition-all duration-75"
          style={{ 
            left: `${pos.x}%`, 
            top: `${pos.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className={`w-4 h-4 border-2 border-white rounded-full ${isDragging ? 'bg-[#FF9800]/50' : 'bg-transparent'} shadow-lg`} />
        </div>
      </div>
    </div>
  );
}

interface Order {
  id: string;
  orderNumber: string;
  client: string;
  clientPhone?: string;
  washer: string;
  service: string;
  amount: number;
  status: string;
  createdAt: string;
  time?: string;
  address?: string;
}

interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  orders: number;
  status: string;
  createdAt: string;
}

// Extended User interface with all fields for full management
interface ExtendedUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  orders: number;
  status: string;
  isActive: boolean;
  plateNumber?: string;
  carColor?: string;
  pin?: string;
  createdAt: string;
  updatedAt?: string;
  washer?: {
    id: string;
    isAvailable: boolean;
    isVerified: boolean;
    rating: number;
    totalRatings: number;
    completedJobs: number;
    totalEarnings: number;
  } | null;
  walletBalance?: number;
}

interface Washer {
  id: string;
  name: string;
  phone: string;
  rating: number;
  completedJobs: number;
  earnings: number;
  isAvailable: boolean;
  isVerified: boolean;
}

interface Stats {
  totalOrders: number;
  todayOrders: number;
  totalUsers: number;
  totalWashers: number;
  activeWashers: number;
  totalServices: number;
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
}

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: string;
  discountType: string;
  discountValue: number;
  code: string | null;
  displayType: string;
  image: string | null;
  imagePosition: string;
  startDate: string;
  endDate: string;
  maxUses: number | null;
  currentUses: number;
  maxUsesPerUser: number;
  minOrderAmount: number | null;
  isActive: boolean;
  createdAt: string;
}

interface Deposit {
  id: string;
  amount: number;
  status: string;
  phoneNumber: string;
  paymentMethod: string;
  description: string | null;
  externalRef: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
}

interface Withdrawal {
  id: string;
  washerId: string;
  amount: number;
  fee: number;
  phoneNumber: string;
  operator: string;
  status: string;
  adminNotes: string | null;
  transactionRef: string | null;
  createdAt: string;
  washer?: {
    id: string;
    userId: string;
    user?: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

export function AdminPanel() {
  const { user, logout } = useAuthStore();
  // setView available if needed for navigation
  useAppStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{day: string, revenue: number}[]>([]);
  const [ordersByService, setOrdersByService] = useState<{name: string, count: number}[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [washers, setWashers] = useState<Washer[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState<string | null>(null); // For "Plus" menu sub-navigation

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
        setRevenueByDay(data.charts.revenueByDay);
        setOrdersByService(data.charts.ordersByService);
        setRecentOrders(data.recentOrders);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search: searchQuery,
      });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: searchQuery });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Fetch washers
  const fetchWashers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/washers');
      const data = await res.json();
      
      if (data.success) {
        setWashers(data.washers);
      }
    } catch (error) {
      console.error('Fetch washers error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch promotions
  const fetchPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/promotions');
      const data = await res.json();
      
      if (data.success) {
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Fetch promotions error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch deposits
  const fetchDeposits = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/deposits?status=PENDING');
      const data = await res.json();

      if (data.success) {
        setDeposits(data.deposits);
      }
    } catch (error) {
      console.error('Fetch deposits error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/withdrawals?status=PENDING');
      const data = await res.json();

      if (data.success) {
        setWithdrawals(data.withdrawals);
      }
    } catch (error) {
      console.error('Fetch withdrawals error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pre-fetch deposits and withdrawals for badge count on mount
  useEffect(() => {
    fetchDeposits();
    fetchWithdrawals();
  }, []);

  // Load data based on active tab or subTab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'washers') {
      fetchWashers();
    } else if (activeTab === 'settings') {
      // Load data based on subTab
      if (subTab === 'promotions') {
        fetchPromotions();
      } else if (subTab === 'deposits') {
        fetchDeposits();
      } else if (subTab === 'withdrawals') {
        fetchWithdrawals();
      } else if (subTab === 'operators') {
        // Operators are loaded in AdminSettings
      }
    } else if (activeTab === 'promotions') {
      fetchPromotions();
    } else if (activeTab === 'deposits') {
      fetchDeposits();
    }
  }, [activeTab, subTab, fetchStats, fetchOrders, fetchUsers, fetchWashers, fetchPromotions, fetchDeposits, fetchWithdrawals]);

  // Handle washer verification
  const handleVerifyWasher = async (washerId: string, action: 'verify' | 'reject') => {
    try {
      const res = await fetch('/api/admin/washers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ washerId, action }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'verify' ? 'Laveur vérifié' : 'Laveur rejeté');
        fetchWashers();
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Handle deposit validation
  const handleDepositAction = async (transactionId: string, action: 'validate' | 'reject') => {
    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, action }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'validate' ? 'Rechargement validé' : 'Rechargement rejeté');
        fetchDeposits();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors du traitement');
    }
  };

  // Handle withdrawal action
  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'approve' ? 'Retrait approuvé' : 'Retrait rejeté');
        fetchWithdrawals();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors du traitement');
    }
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-blue-100 text-blue-800',
      EN_ROUTE: 'bg-blue-100 text-blue-800',
      ARRIVED: 'bg-purple-100 text-purple-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      ACCEPTED: 'Acceptée',
      EN_ROUTE: 'En route',
      ARRIVED: 'Arrivé',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée',
      CANCELLED: 'Annulée',
    };
    
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] overflow-hidden">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
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

      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0 sticky top-6 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-lg font-bold">
              A
            </div>
            <div>
              <div className="font-semibold text-[#212121]">Admin</div>
              <div className="text-xs text-[#757575]">{user?.name || 'Socline'}</div>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={logout} className="text-red-500">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16">
        {activeTab === 'dashboard' && (
          <AdminDashboard 
            stats={stats}
            revenueByDay={revenueByDay}
            ordersByService={ordersByService}
            recentOrders={recentOrders}
            isLoading={isLoading}
            onRefresh={fetchStats}
          />
        )}
        {activeTab === 'orders' && (
          <AdminOrders 
            orders={orders}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isLoading={isLoading}
            onRefresh={fetchOrders}
            getStatusBadge={getStatusBadge}
          />
        )}
        {activeTab === 'users' && (
          <AdminUsers 
            users={users}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isLoading={isLoading}
            onRefresh={fetchUsers}
          />
        )}
        {activeTab === 'washers' && (
          <AdminWashers 
            washers={washers}
            isLoading={isLoading}
            onRefresh={fetchWashers}
            onVerify={handleVerifyWasher}
          />
        )}
        {activeTab === 'services' && <AdminServices />}
        {activeTab === 'promotions' && (
          <AdminPromotions 
            promotions={promotions}
            isLoading={isLoading}
            onRefresh={fetchPromotions}
          />
        )}
        {activeTab === 'deposits' && (
          <AdminDeposits 
            deposits={deposits}
            isLoading={isLoading}
            onRefresh={fetchDeposits}
            onAction={handleDepositAction}
          />
        )}
        {activeTab === 'finances' && <AdminFinances stats={stats} />}
        {activeTab === 'settings' && (
          subTab ? (
            // Show sub-content with back button
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setSubTab(null)}
                  className="p-2 rounded-full bg-[#F5F5F5] hover:bg-[#E0E0E0]"
                >
                  <ArrowLeft className="w-5 h-5 text-[#757575]" />
                </button>
                <h2 className="font-semibold text-lg text-[#212121]">
                  {subTab === 'deposits' && 'Demandes de recharge'}
                  {subTab === 'withdrawals' && 'Retraits Laveurs'}
                  {subTab === 'subscription-plans' && 'Forfaits Abonnements'}
                  {subTab === 'subscriptions' && 'Abonnements Clients'}
                  {subTab === 'promotions' && 'Promotions'}
                  {subTab === 'services' && 'Services'}
                  {subTab === 'finances' && 'Finances'}
                  {subTab === 'operators' && 'Opérateurs Mobile Money'}
                  {subTab === 'settings' && 'Paramètres'}
                </h2>
              </div>
              {subTab === 'deposits' && (
                <AdminDeposits
                  deposits={deposits}
                  isLoading={isLoading}
                  onRefresh={fetchDeposits}
                  onAction={handleDepositAction}
                />
              )}
              {subTab === 'withdrawals' && (
                <AdminWithdrawals
                  withdrawals={withdrawals}
                  isLoading={isLoading}
                  onRefresh={fetchWithdrawals}
                  onAction={handleWithdrawalAction}
                />
              )}
              {subTab === 'subscription-plans' && <AdminSubscriptionPlans />}
              {subTab === 'subscriptions' && <AdminSubscriptions />}
              {subTab === 'promotions' && (
                <AdminPromotions
                  promotions={promotions}
                  isLoading={isLoading}
                  onRefresh={fetchPromotions}
                />
              )}
              {subTab === 'services' && <AdminServices />}
              {subTab === 'finances' && <AdminFinances stats={stats} />}
              {subTab === 'operators' && <AdminOperatorsSection />}
              {subTab === 'settings' && <AdminSettingsContent />}
            </div>
          ) : (
            // Show "Plus" menu
            <AdminPlusMenu
              depositsCount={deposits.filter(d => d.status === 'PENDING').length}
              withdrawalsCount={withdrawals.filter(w => w.status === 'PENDING').length}
              onSelect={setSubTab}
            />
          )
        )}
      </div>

      {/* Android Bottom Navigation - FIXED at bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-center h-14 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'users', icon: Users, label: 'Utilis.' },
          { id: 'washers', icon: Car, label: 'Laveurs' },
          { id: 'orders', icon: Clock, label: 'Commandes' },
          { id: 'settings', icon: Settings, label: 'Plus' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-4 transition-all ${
                isActive ? 'text-[#FF9800]' : 'text-[#757575]'
              }`}
            >
              <tab.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard({ stats, revenueByDay, ordersByService, recentOrders, isLoading, onRefresh }: { 
  stats: Stats | null;
  revenueByDay: {day: string, revenue: number}[];
  ordersByService: {name: string, count: number}[];
  recentOrders: Order[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  if (isLoading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Dashboard</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#2196F3]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Commandes aujourd&apos;hui</p>
                <p className="text-xl font-bold text-[#212121]">{stats.todayOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Revenus aujourd&apos;hui</p>
                <HideableBalanceLight
                  balance={stats.todayRevenue}
                  currency="XOF"
                  size="lg"
                  storageKey="hide-admin-today-revenue"
                  balanceClassName="text-[#4CAF50]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
                <Car className="w-5 h-5 text-[#FF9800]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Laveurs actifs</p>
                <p className="text-xl font-bold text-[#212121]">{stats.activeWashers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FCE4EC] rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-[#E91E63]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Clients</p>
                <p className="text-xl font-bold text-[#212121]">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-sm text-[#212121] mb-3">Aperçu rapide</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</div>
            <div className="text-xs text-[#757575]">En attente</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgressOrders}</div>
            <div className="text-xs text-[#757575]">En cours</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completedOrders}</div>
            <div className="text-xs text-[#757575]">Terminées</div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revenus de la semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end justify-between gap-1">
            {revenueByDay.map((item, i) => {
              const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);
              const height = item.revenue > 0 ? (item.revenue / maxRevenue) * 100 : 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-[#FF9800] to-[#FFB74D] rounded-t"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-[#757575]">{item.day}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Commandes récentes</CardTitle>
          <span className="text-xs text-[#FF9800]">{recentOrders.length} commandes</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#F5F5F5]">
            {recentOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#757575]">{order.id}</span>
                    <Badge className={
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {order.status === 'COMPLETED' && 'Terminée'}
                      {order.status === 'IN_PROGRESS' && 'En cours'}
                      {order.status === 'PENDING' && 'En attente'}
                      {order.status === 'ACCEPTED' && 'Acceptée'}
                      {order.status === 'EN_ROUTE' && 'En route'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-[#212121] mt-1">{order.client}</p>
                  <p className="text-xs text-[#757575]">{order.service}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#FF9800]">{order.amount.toLocaleString()} XOF</p>
                  <p className="text-xs text-[#757575]">{order.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Orders
function AdminOrders({ orders, statusFilter, setStatusFilter, searchQuery, setSearchQuery, isLoading, onRefresh, getStatusBadge }: { 
  orders: Order[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  getStatusBadge: (status: string) => JSX.Element;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Commandes</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 bg-white">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="PENDING">En attente</SelectItem>
            <SelectItem value="IN_PROGRESS">En cours</SelectItem>
            <SelectItem value="COMPLETED">Terminées</SelectItem>
            <SelectItem value="CANCELLED">Annulées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-mono text-xs text-[#757575]">{order.orderNumber}</span>
                    <h3 className="font-medium text-[#212121]">{order.client}</h3>
                    <p className="text-xs text-[#757575]">{order.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#FF9800]">{order.amount.toLocaleString()} XOF</p>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#757575]">
                  <span>Laveur: {order.washer}</span>
                  <span>•</span>
                  <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Clock className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune commande trouvée</p>
        </div>
      )}
    </div>
  );
}

// Admin Users - Full Management
function AdminUsers({ users, searchQuery, setSearchQuery, isLoading, onRefresh }: { 
  users: ExtendedUser[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ExtendedUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ExtendedUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<ExtendedUser[]>([]);
  
  // Form state for new user
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    email: '',
    pin: '1234',
    role: 'CLIENT' as 'CLIENT' | 'WASHER' | 'ADMIN',
  });

  // Form state for editing user
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    pin: '',
    role: 'CLIENT' as 'CLIENT' | 'WASHER' | 'ADMIN',
    isActive: true,
  });

  // Fetch users with role filter
  const fetchUsersWithFilter = useCallback(async () => {
    setIsSaving(true);
    try {
      const params = new URLSearchParams({ 
        search: searchQuery,
        role: roleFilter,
        limit: '100'
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsSaving(false);
    }
  }, [searchQuery, roleFilter]);

  useEffect(() => {
    fetchUsersWithFilter();
  }, [fetchUsersWithFilter]);

  // Use allUsers if available, otherwise fall back to passed users
  const displayUsers = allUsers.length > 0 || searchQuery || roleFilter !== 'all' ? allUsers : users;

  // Create new user
  const handleCreateUser = async () => {
    if (!newUser.phone) {
      toast.error('Le numéro de téléphone est requis');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUser,
          createWasher: newUser.role === 'WASHER',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur créé avec succès');
        setShowAddModal(false);
        setNewUser({ name: '', phone: '', email: '', pin: '1234', role: 'CLIENT' });
        fetchUsersWithFilter();
      } else {
        toast.error(data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (user: ExtendedUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      phone: user.phone,
      email: user.email || '',
      pin: user.pin || '1234',
      role: user.role as 'CLIENT' | 'WASHER' | 'ADMIN',
      isActive: user.isActive,
    });
    setShowEditModal(true);
  };

  // Update user
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          pin: editForm.pin,
          role: editForm.role,
          isActive: editForm.isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur mis à jour');
        setShowEditModal(false);
        setEditingUser(null);
        fetchUsersWithFilter();
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (user: ExtendedUser) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          isActive: !user.isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(user.isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
        fetchUsersWithFilter();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur supprimé');
        setDeleteConfirm(null);
        fetchUsersWithFilter();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800',
      WASHER: 'bg-orange-100 text-orange-800',
      CLIENT: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      ADMIN: 'Admin',
      WASHER: 'Laveur',
      CLIENT: 'Client',
    };
    return <Badge className={styles[role] || 'bg-gray-100 text-gray-800'}>{labels[role] || role}</Badge>;
  };

  // Get avatar color based on role
  const getAvatarColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-600',
      WASHER: 'bg-orange-100 text-orange-600',
      CLIENT: 'bg-blue-100 text-blue-600',
    };
    return colors[role] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Gestion des utilisateurs</h2>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsersWithFilter} disabled={isLoading || isSaving} className="text-[#FF9800]">
            <RefreshCw className={`w-5 h-5 ${(isLoading || isSaving) ? 'animate-spin' : ''}`} />
          </button>
          <Button 
            size="sm" 
            className="bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
          onClick={() => {
            setNewUser({ name: '', phone: '', email: '', pin: '1234', role: 'CLIENT' });
            setShowAddModal(true);
          }}
        >
          <Users className="w-4 h-4 mr-1" />
          Nouveau client
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50"
          onClick={() => {
            setNewUser({ name: '', phone: '', email: '', pin: '1234', role: 'WASHER' });
            setShowAddModal(true);
          }}
        >
          <Car className="w-4 h-4 mr-1" />
          Nouveau laveur
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => {
            setNewUser({ name: '', phone: '', email: '', pin: '1234', role: 'ADMIN' });
            setShowAddModal(true);
          }}
        >
          <Settings className="w-4 h-4 mr-1" />
          Nouvel admin
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
          <Input
            placeholder="Rechercher par nom, téléphone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-32 bg-white">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="CLIENT">Clients</SelectItem>
            <SelectItem value="WASHER">Laveurs</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setRoleFilter('CLIENT')}>
          <div className="text-lg font-bold text-blue-600">
            {displayUsers.filter(u => u.role === 'CLIENT').length}
          </div>
          <div className="text-xs text-blue-800">Clients</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 text-center cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => setRoleFilter('WASHER')}>
          <div className="text-lg font-bold text-orange-600">
            {displayUsers.filter(u => u.role === 'WASHER').length}
          </div>
          <div className="text-xs text-orange-800">Laveurs</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center cursor-pointer hover:bg-red-100 transition-colors" onClick={() => setRoleFilter('ADMIN')}>
          <div className="text-lg font-bold text-red-600">
            {displayUsers.filter(u => u.role === 'ADMIN').length}
          </div>
          <div className="text-xs text-red-800">Admins</div>
        </div>
      </div>

      {/* Users List */}
      {isLoading || isSaving ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : displayUsers.length > 0 ? (
        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {displayUsers.map((user) => (
            <Card key={user.id} className={`border-0 shadow-sm ${!user.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={getAvatarColor(user.role)}>
                      {user.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[#212121] truncate">{user.name || 'N/A'}</h3>
                      {getRoleBadge(user.role)}
                    </div>
                    <p className="text-xs text-[#757575]">{user.phone}</p>
                    {user.email && <p className="text-xs text-[#9E9E9E]">{user.email}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditModal(user)}
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.isActive ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setDeleteConfirm(user)}
                      disabled={user.role === 'ADMIN'} // Don't allow deleting admins
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                
                {/* Additional info for washers */}
                {user.role === 'WASHER' && user.washer && (
                  <div className="mt-2 pt-2 border-t border-[#F5F5F5] flex justify-between text-xs text-[#757575]">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span>{user.washer.rating > 0 ? user.washer.rating.toFixed(1) : '-'}</span>
                    </div>
                    <span>{user.washer.completedJobs} jobs</span>
                    <span className="text-green-600 font-medium">{user.washer.totalEarnings.toLocaleString()} XOF</span>
                  </div>
                )}
                
                {/* Wallet balance for clients */}
                {user.role === 'CLIENT' && (
                  <div className="mt-2 pt-2 border-t border-[#F5F5F5] flex justify-between text-xs">
                    <span className="text-[#757575]">{user.orders} commandes</span>
                    <span className="text-green-600 font-medium">
                      Solde: {(user.walletBalance || 0).toLocaleString()} XOF
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Users className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucun utilisateur trouvé</p>
        </div>
      )}

      {/* Add User Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-phone">Téléphone *</Label>
              <Input
                id="new-phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Ex: 70123456 ou 90123456"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-name">Nom complet</Label>
              <Input
                id="new-name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Nom de l'utilisateur"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-pin">Code PIN</Label>
              <Input
                id="new-pin"
                value={newUser.pin}
                onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                placeholder="1234"
                maxLength={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-role">Rôle</Label>
              <Select value={newUser.role} onValueChange={(v: any) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Client</SelectItem>
                  <SelectItem value="WASHER">Laveur</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button 
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleCreateUser}
              disabled={isSaving || !newUser.phone}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Ex: 70123456 ou 90123456"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nom de l'utilisateur"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-pin">Code PIN</Label>
              <Input
                id="edit-pin"
                value={editForm.pin}
                onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })}
                placeholder="1234"
                maxLength={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rôle</Label>
              <Select value={editForm.role} onValueChange={(v: any) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Client</SelectItem>
                  <SelectItem value="WASHER">Laveur</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Compte actif</Label>
              <Switch
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button 
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleUpdateUser}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-[#757575]">
              Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm?.name || 'cet utilisateur'}</strong> ?
            </p>
            <p className="text-xs text-red-500 mt-2">
              Cette action est irréversible. Les utilisateurs avec des commandes ne peuvent pas être supprimés.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSaving}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Washers
function AdminWashers({ washers, isLoading, onRefresh, onVerify }: { 
  washers: Washer[];
  isLoading: boolean;
  onRefresh: () => void;
  onVerify: (id: string, action: 'verify' | 'reject') => void;
}) {
  const pendingWashers = washers.filter(w => !w.isVerified);
  const verifiedWashers = washers.filter(w => w.isVerified);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Gestion des laveurs</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-orange-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-orange-600">{washers.length}</div>
          <div className="text-xs text-orange-800">Total</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-600">{washers.filter(w => w.isAvailable && w.isVerified).length}</div>
          <div className="text-xs text-green-800">En ligne</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-yellow-600">{pendingWashers.length}</div>
          <div className="text-xs text-yellow-800">En attente</div>
        </div>
      </div>

      {/* Pending Verifications */}
      {pendingWashers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800 text-sm">
              <AlertCircle className="w-4 h-4" />
              En attente de vérification ({pendingWashers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWashers.map((washer) => (
              <div key={washer.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-[#FFF3E0] text-[#FF9800]">
                      {washer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-[#212121]">{washer.name}</p>
                    <p className="text-xs text-[#757575]">{washer.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onVerify(washer.id, 'verify')}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onVerify(washer.id, 'reject')}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Verified Washers */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : verifiedWashers.length > 0 ? (
        <div className="space-y-3">
          {verifiedWashers.map((washer) => (
            <Card key={washer.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-[#E8F5E9] text-[#4CAF50]">
                      {washer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-medium text-[#212121]">{washer.name}</h3>
                    <p className="text-xs text-[#757575]">{washer.phone}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{washer.rating > 0 ? washer.rating.toFixed(1) : '-'}</span>
                    </div>
                    <Badge className={washer.isAvailable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {washer.isAvailable ? 'En ligne' : 'Hors ligne'}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-[#F5F5F5] text-xs text-[#757575]">
                  <span>{washer.completedJobs} jobs</span>
                  <span className="font-medium text-[#4CAF50]">{washer.earnings.toLocaleString()} XOF gagnés</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Car className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucun laveur vérifié</p>
        </div>
      )}
    </div>
  );
}

// Admin Services
function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Fetch services error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleEditService = (service: any) => {
    setEditingService(service);
    setEditName(service.name);
    setEditDescription(service.description || '');
    setEditPrice(service.price.toString());
    setEditDuration(service.duration.toString());
  };

  const handleSaveService = async () => {
    if (!editingService) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/services/${editingService.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          price: parseInt(editPrice),
          duration: parseInt(editDuration),
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Service mis à jour avec succès');
        setEditingService(null);
        fetchServices();
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Update service error:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (service: any) => {
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(service.isActive ? 'Service désactivé' : 'Service activé');
        fetchServices();
      }
    } catch (error) {
      toast.error('Erreur lors de la modification');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Services</h2>
        <Button size="sm" className="bg-[#FF9800] hover:bg-[#F57C00]">
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[#212121]">{service.name}</h3>
                      <Badge variant="outline" className="text-xs">{service.category}</Badge>
                    </div>
                    <p className="text-xs text-[#757575] mt-1">{service.description}</p>
                    <p className="text-xs text-[#757575] mt-1">{service.duration} min</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="font-bold text-[#FF9800] text-lg">{service.price.toLocaleString()} XOF</p>
                    <div className="flex items-center gap-2">
                      <Badge className={service.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {service.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => handleEditService(service)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Modifier
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Service Dialog */}
      <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le service</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du service</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nom du service"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prix (FCFA)</Label>
                <Input
                  id="price"
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="Prix"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Durée (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="Durée"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingService(null)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button 
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleSaveService}
              disabled={isSaving || !editPrice || !editName}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Finances
function AdminFinances({ stats }: { stats: Stats | null }) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg text-[#212121]">Finances</h2>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#757575]">Revenus totaux</p>
            <HideableBalanceLight
              balance={stats?.totalRevenue || 0}
              currency="XOF"
              size="lg"
              storageKey="hide-admin-total-revenue"
              balanceClassName="text-[#4CAF50]"
            />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#757575]">Ce mois</p>
            <HideableBalanceLight
              balance={stats?.monthRevenue || 0}
              currency="XOF"
              size="lg"
              storageKey="hide-admin-month-revenue"
              balanceClassName="text-[#2196F3]"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#757575]">Commissions (15%)</p>
              <HideableBalanceLight
                balance={((stats?.totalRevenue || 0) * 0.15)}
                currency="XOF"
                size="lg"
                storageKey="hide-admin-commissions"
                balanceClassName="text-[#FF9800]"
              />
            </div>
            <TrendingUp className="w-8 h-8 text-[#FF9800]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Plus Menu - Main menu for "Plus" tab
function AdminPlusMenu({ depositsCount, withdrawalsCount, onSelect }: {
  depositsCount: number;
  withdrawalsCount: number;
  onSelect: (tab: string) => void;
}) {
  const { logout } = useAuthStore();

  const menuItems = [
    {
      id: 'deposits',
      icon: Wallet,
      label: 'Demandes de recharge',
      description: 'Valider les rechargements de portefeuille',
      badge: depositsCount > 0 ? depositsCount : undefined,
      color: '#4CAF50',
    },
    {
      id: 'withdrawals',
      icon: Banknote,
      label: 'Retraits Laveurs',
      description: 'Valider les demandes de retrait',
      badge: withdrawalsCount > 0 ? withdrawalsCount : undefined,
      color: '#9C27B0',
    },
    {
      id: 'subscription-plans',
      icon: Tag,
      label: 'Forfaits Abonnements',
      description: 'Créer et modifier les forfaits',
      color: '#E91E63',
    },
    {
      id: 'subscriptions',
      icon: Tag,
      label: 'Abonnements Clients',
      description: 'Gérer les abonnements et validations',
      color: '#9C27B0',
    },
    {
      id: 'promotions',
      icon: Percent,
      label: 'Promotions',
      description: 'Gérer les codes promo et offres',
      color: '#FF5722',
    },
    {
      id: 'services',
      icon: Car,
      label: 'Services',
      description: 'Gérer les types de lavage',
      color: '#2196F3',
    },
    {
      id: 'finances',
      icon: DollarSign,
      label: 'Finances',
      description: 'Rapports et statistiques financières',
      color: '#FF9800',
    },
    {
      id: 'operators',
      icon: Phone,
      label: 'Opérateurs Mobile Money',
      description: 'Configurer les opérateurs de paiement',
      color: '#00BCD4',
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Paramètres',
      description: 'Configuration générale',
      color: '#607D8B',
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg text-[#212121]">Plus d&apos;options</h2>

      <div className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-[#E0E0E0] hover:border-[#FF9800] transition-all active:scale-[0.98]"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${item.color}20` }}
            >
              <item.icon className="w-6 h-6" style={{ color: item.color }} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#212121]">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#757575]">{item.description}</p>
            </div>
            <ChevronDown className="w-5 h-5 text-[#9E9E9E] -rotate-90" />
          </button>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 transition-all mt-6"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Déconnexion</span>
      </button>
    </div>
  );
}

// Admin Operators Section
function AdminOperatorsSection() {
  const [operators, setOperators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingOperator, setEditingOperator] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    ussdPattern: '',
    recipientNumber: '',
    color: '#FF9800',
    minAmount: '100',
    maxAmount: '500000',
    isActive: true,
  });

  const fetchOperators = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operators');
      const data = await res.json();
      if (data.success) {
        setOperators(data.operators);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  const handleSave = async () => {
    try {
      const url = editingOperator ? '/api/operators' : '/api/operators';
      const method = editingOperator ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOperator ? { ...form, id: editingOperator.id } : form),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingOperator ? 'Opérateur modifié' : 'Opérateur créé');
        setShowForm(false);
        setEditingOperator(null);
        setForm({
          name: '',
          displayName: '',
          ussdPattern: '',
          recipientNumber: '',
          color: '#FF9800',
          minAmount: '100',
          maxAmount: '500000',
          isActive: true,
        });
        fetchOperators();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (operator: any) => {
    setEditingOperator(operator);
    setForm({
      name: operator.name,
      displayName: operator.displayName,
      ussdPattern: operator.ussdPattern,
      recipientNumber: operator.recipientNumber,
      color: operator.color,
      minAmount: operator.minAmount.toString(),
      maxAmount: operator.maxAmount.toString(),
      isActive: operator.isActive,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#757575]">Gérez les opérateurs de paiement mobile</p>
        <Button
          onClick={() => {
            setEditingOperator(null);
            setForm({
              name: '',
              displayName: '',
              ussdPattern: '',
              recipientNumber: '',
              color: '#FF9800',
              minAmount: '100',
              maxAmount: '500000',
              isActive: true,
            });
            setShowForm(true);
          }}
          className="bg-[#FF9800] hover:bg-[#F57C00]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : showForm ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Nom technique</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mixx"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Nom affiché</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Mixx by Yas"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#757575]">Pattern USSD</Label>
              <Input
                value={form.ussdPattern}
                onChange={(e) => setForm({ ...form, ussdPattern: e.target.value })}
                placeholder="*145*1*{montant}*{numero}*2#"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Numéro destinataire</Label>
                <Input
                  value={form.recipientNumber}
                  onChange={(e) => setForm({ ...form, recipientNumber: e.target.value })}
                  placeholder="90000000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Couleur</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-9 p-1"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Montant min (F)</Label>
                <Input
                  type="number"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Montant max (F)</Label>
                <Input
                  type="number"
                  value={form.maxAmount}
                  onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label className="text-sm">Actif</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]">
                {editingOperator ? 'Modifier' : 'Créer'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : operators.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg">
          <Phone className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Aucun opérateur configuré</p>
        </div>
      ) : (
        <div className="space-y-2">
          {operators.map((operator) => (
            <Card key={operator.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${operator.color}20` }}
                    >
                      <Phone className="w-5 h-5" style={{ color: operator.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#212121]">{operator.displayName}</span>
                        {!operator.isActive && (
                          <Badge className="bg-gray-100 text-gray-600">Inactif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#757575]">{operator.ussdPattern}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(operator)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Admin Settings Content
function AdminSettingsContent() {
  const { logout } = useAuthStore();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Données de test réinitialisées');
        // Recharger la page pour refléter les changements
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(data.error || 'Erreur lors de la réinitialisation');
      }
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Déconnexion réussie');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#757575]">Configuration générale de l&apos;application</p>

      {/* App Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium text-[#212121]">Informations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#757575]">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#757575]">Environnement</span>
              <Badge className="bg-green-100 text-green-700">Production</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium text-[#212121]">Actions rapides</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleResetData}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Réinitialiser les données de test
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Promotions
function AdminPromotions({ promotions, isLoading, onRefresh }: { 
  promotions: Promotion[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    code: '',
    displayType: 'TEXT',
    image: '',
    imagePosition: 'center',
    startDate: '',
    endDate: '',
    maxUses: '',
    maxUsesPerUser: '1',
    minOrderAmount: '',
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      code: '',
      displayType: 'TEXT',
      image: '',
      imagePosition: 'center',
      startDate: '',
      endDate: '',
      maxUses: '',
      maxUsesPerUser: '1',
      minOrderAmount: '',
      isActive: true,
    });
    setImagePreview(null);
    setEditingPromo(null);
    setShowForm(false);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isPromoActive = (promo: Promotion) => {
    if (!promo.isActive) return false;
    const now = new Date();
    const start = promo.startDate ? new Date(promo.startDate) : null;
    const end = promo.endDate ? new Date(promo.endDate) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('L\'image ne doit pas dépasser 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setFormData({ ...formData, image: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    try {
      const method = editingPromo ? 'PUT' : 'POST';
      const body = editingPromo
        ? { id: editingPromo.id, ...formData }
        : formData;

      const res = await fetch('/api/promotions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingPromo ? 'Promotion mise à jour' : 'Promotion créée');
        resetForm();
        onRefresh();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      description: promo.description || '',
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      code: promo.code || '',
      displayType: promo.displayType || 'TEXT',
      image: promo.image || '',
      imagePosition: promo.imagePosition || 'center',
      startDate: new Date(promo.startDate).toISOString().split('T')[0],
      endDate: new Date(promo.endDate).toISOString().split('T')[0],
      maxUses: promo.maxUses?.toString() || '',
      maxUsesPerUser: promo.maxUsesPerUser.toString(),
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      isActive: promo.isActive,
    });
    if (promo.image) {
      setImagePreview(promo.image);
    }
    setShowForm(true);
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      const res = await fetch('/api/promotions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: promo.id,
          isActive: !promo.isActive,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(promo.isActive ? 'Promotion désactivée' : 'Promotion activée');
        onRefresh();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg text-[#212121]">Promotions</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800] p-1">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Button 
            size="sm" 
            className="bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Nouvelle</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-[#212121]">
              {editingPromo ? 'Modifier la promotion' : 'Nouvelle promotion'}
            </h3>
            
            <div>
              <Label className="text-xs text-[#757575]">Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Offre spéciale été"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-[#757575]">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de l'offre"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Type de réduction</Label>
                <Select 
                  value={formData.discountType} 
                  onValueChange={(v) => setFormData({ ...formData, discountType: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Pourcentage (%)</SelectItem>
                    <SelectItem value="FIXED">Montant fixe (F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Valeur *</Label>
                <Input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '5000'}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#757575]">Code promo (optionnel)</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="WASHGO20"
                className="mt-1 uppercase"
              />
            </div>

            {/* Display Type Selection */}
            <div>
              <Label className="text-xs text-[#757575]">Type d'affichage</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, displayType: 'TEXT', image: '' });
                    setImagePreview(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.displayType === 'TEXT' 
                      ? 'border-[#FF9800] bg-[#FFF3E0] text-[#FF9800]' 
                      : 'border-[#E0E0E0] text-[#757575]'
                  }`}
                >
                  Texte uniquement
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, displayType: 'IMAGE' })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.displayType === 'IMAGE' 
                      ? 'border-[#FF9800] bg-[#FFF3E0] text-[#FF9800]' 
                      : 'border-[#E0E0E0] text-[#757575]'
                  }`}
                >
                  Avec image
                </button>
              </div>
            </div>

            {/* Image upload - only show if displayType is IMAGE */}
            {formData.displayType === 'IMAGE' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-[#757575]">Image de la promotion *</Label>
                  <div className="mt-1">
                    <label className={`flex flex-col items-center justify-center w-full ${imagePreview ? 'h-48' : 'h-32'} border-2 border-dashed border-[#E0E0E0] rounded-lg ${!imagePreview ? 'cursor-pointer hover:bg-[#FAFAFA]' : ''} transition-colors`}>
                      {imagePreview ? (
                        <ImagePositionEditor
                          imageSrc={imagePreview}
                          position={formData.imagePosition}
                          onPositionChange={(pos) => setFormData({ ...formData, imagePosition: pos })}
                          onRemove={() => {
                            setImagePreview(null);
                            setFormData({ ...formData, image: '', imagePosition: 'center' });
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ImageIcon className="w-8 h-8 text-[#9E9E9E] mb-2" />
                          <p className="text-xs text-[#757575]">Cliquez pour ajouter une image</p>
                          <p className="text-xs text-[#9E9E9E]">PNG, JPG (max 2MB)</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Date début *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Date fin *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
              />
              <Label className="text-xs text-[#757575]">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={handleSubmit}
              >
                {editingPromo ? 'Mettre à jour' : 'Créer'}
              </Button>
              <Button 
                variant="outline"
                onClick={resetForm}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotions List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : promotions.length > 0 ? (
        <div className="space-y-3">
          {promotions.map((promo) => (
            <Card key={promo.id} className={`border-0 shadow-sm ${!promo.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Image thumbnail */}
                  {promo.image && (
                    <div className="w-full sm:w-20 h-32 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <img 
                        src={promo.image} 
                        alt={promo.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: promo.imagePosition || 'center' }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="w-4 h-4 text-[#FF9800] flex-shrink-0" />
                          <h3 className="font-medium text-[#212121] truncate">{promo.name}</h3>
                          <Badge className={
                            isPromoActive(promo) 
                              ? 'bg-green-100 text-green-800' 
                              : promo.isActive 
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }>
                            {isPromoActive(promo) ? 'Active' : promo.isActive ? 'À venir' : 'Inactive'}
                          </Badge>
                        </div>
                        {promo.description && (
                          <p className="text-xs text-[#757575] mt-1 line-clamp-2">{promo.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-lg font-bold text-[#FF9800]">
                            {promo.discountType === 'PERCENTAGE' 
                              ? `-${promo.discountValue}%` 
                              : `-${promo.discountValue.toLocaleString()}F`}
                          </span>
                          {promo.code && (
                            <Badge className="bg-[#FFF3E0] text-[#FF9800]">
                              {promo.code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#757575] mt-2">
                          {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                        </p>
                        <p className="text-xs text-[#9E9E9E] mt-1">
                          Utilisé {promo.currentUses} fois
                        </p>
                      </div>
                      {/* Action buttons - horizontal on mobile, vertical on desktop */}
                      <div className="flex sm:flex-col gap-1 sm:items-end">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEdit(promo)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleToggleActive(promo)}
                        >
                          {promo.isActive ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDelete(promo.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Tag className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune promotion</p>
          <Button 
            className="mt-4 bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowForm(true)}
          >
            Créer une promotion
          </Button>
        </div>
      )}
    </div>
  );
}

// Admin Deposits (Recharges)
function AdminDeposits({ deposits, isLoading, onRefresh, onAction }: { 
  deposits: Deposit[];
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (id: string, action: 'validate' | 'reject') => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Demandes de recharge</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Deposits */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : deposits.length > 0 ? (
        <div className="space-y-3">
          {deposits.map((deposit) => (
            <Card key={deposit.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-[#212121]">{deposit.user?.name || 'Client'}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
                    </div>
                    <p className="text-xs text-[#757575]">{deposit.user?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#FF9800]">{deposit.amount.toLocaleString()} XOF</p>
                  </div>
                </div>
                
                <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#757575]" />
                    <span className="text-sm text-[#212121]">+228 {deposit.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#757575]" />
                    <span className="text-sm text-[#212121]">{deposit.paymentMethod}</span>
                  </div>
                  <div className="text-xs text-[#9E9E9E]">
                    {new Date(deposit.createdAt).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => onAction(deposit.id, 'validate')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Valider
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onAction(deposit.id, 'reject')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Échoué
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Wallet className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune demande de recharge en attente</p>
        </div>
      )}
    </div>
  );
}

// Admin Withdrawals (Retraits Laveurs)
function AdminWithdrawals({ withdrawals, isLoading, onRefresh, onAction }: { 
  withdrawals: Withdrawal[];
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (id: string, action: 'approve' | 'reject') => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Demandes de retrait</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Withdrawals */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : withdrawals.length > 0 ? (
        <div className="space-y-3">
          {withdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-[#212121]">{withdrawal.washer?.user?.name || 'Laveur'}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
                    </div>
                    <p className="text-xs text-[#757575]">{withdrawal.washer?.user?.phone || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#9C27B0]">{withdrawal.amount.toLocaleString()} XOF</p>
                  </div>
                </div>
                
                <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#757575]" />
                    <span className="text-sm text-[#212121]">+228 {withdrawal.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#757575]" />
                    <span className="text-sm text-[#212121]">{withdrawal.operator}</span>
                  </div>
                  <div className="text-xs text-[#9E9E9E]">
                    {new Date(withdrawal.createdAt).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => onAction(withdrawal.id, 'approve')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onAction(withdrawal.id, 'reject')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Banknote className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune demande de retrait en attente</p>
        </div>
      )}
    </div>
  );
}

// Admin Subscription Plans - Manage subscription plans (forfaits)
interface SubscriptionPlanData {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  quarterlyPrice: number | null;
  yearlyPrice: number | null;
  washCount: number;
  serviceId: string;
  service: {
    id: string;
    name: string;
    price: number;
  };
  priority: number;
  bonusWashes: number;
  freeOptions: number;
  includesExpress: boolean;
  includesVip: boolean;
  features: string | null;
  isActive: boolean;
  displayOrder: number;
  subscribersCount: number;
  createdAt: string;
}

function AdminSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlanData[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SubscriptionPlanData | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    price: '',
    quarterlyPrice: '',
    yearlyPrice: '',
    washCount: '4',
    serviceId: '',
    priority: '0',
    bonusWashes: '0',
    freeOptions: '0',
    includesExpress: false,
    includesVip: false,
    features: '',
    isActive: true,
    displayOrder: '0',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, servicesRes] = await Promise.all([
        fetch('/api/subscription-plans'),
        fetch('/api/services')
      ]);
      
      const plansData = await plansRes.json();
      const servicesData = await servicesRes.json();
      
      if (plansData.success) {
        setPlans(plansData.plans);
      }
      if (servicesData.success) {
        setServices(servicesData.services.filter((s: any) => s.isActive));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      price: '',
      quarterlyPrice: '',
      yearlyPrice: '',
      washCount: '4',
      serviceId: '',
      priority: '0',
      bonusWashes: '0',
      freeOptions: '0',
      includesExpress: false,
      includesVip: false,
      features: '',
      isActive: true,
      displayOrder: '0',
    });
    setEditingPlan(null);
    setShowForm(false);
  };

  const handleEdit = (plan: SubscriptionPlanData) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: plan.price.toString(),
      quarterlyPrice: plan.quarterlyPrice?.toString() || '',
      yearlyPrice: plan.yearlyPrice?.toString() || '',
      washCount: plan.washCount.toString(),
      serviceId: plan.serviceId,
      priority: plan.priority.toString(),
      bonusWashes: plan.bonusWashes.toString(),
      freeOptions: plan.freeOptions.toString(),
      includesExpress: plan.includesExpress,
      includesVip: plan.includesVip,
      features: plan.features || '',
      isActive: plan.isActive,
      displayOrder: plan.displayOrder.toString(),
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.displayName || !formData.price || !formData.washCount || !formData.serviceId) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSaving(true);
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const body = editingPlan
        ? { id: editingPlan.id, ...formData }
        : formData;

      const res = await fetch('/api/subscription-plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingPlan ? 'Forfait mis à jour' : 'Forfait créé');
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlanData) => {
    try {
      const res = await fetch('/api/subscription-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(plan.isActive ? 'Forfait désactivé' : 'Forfait activé');
        fetchData();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/subscription-plans?id=${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Forfait supprimé');
        setDeleteConfirm(null);
        fetchData();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityLabel = (priority: number) => {
    const labels: Record<number, string> = {
      0: 'Normale',
      1: 'Légère',
      2: 'Priorité',
      3: 'Maximale',
    };
    return labels[priority] || 'Normale';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#757575]">Gérez les forfaits d&apos;abonnement disponibles</p>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-[#FF9800] hover:bg-[#F57C00]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau forfait
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-[#212121]">
              {editingPlan ? 'Modifier le forfait' : 'Nouveau forfait'}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Nom technique *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  placeholder="ESSENTIEL"
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Nom affiché *</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Abonnement Essentiel"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#757575]">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du forfait"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-[#757575]">Service associé *</Label>
              <Select value={formData.serviceId} onValueChange={(v) => setFormData({ ...formData, serviceId: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.price.toLocaleString()} XOF)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Prix mensuel (F) *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="15000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Prix trimestriel (F)</Label>
                <Input
                  type="number"
                  value={formData.quarterlyPrice}
                  onChange={(e) => setFormData({ ...formData, quarterlyPrice: e.target.value })}
                  placeholder="40000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Prix annuel (F)</Label>
                <Input
                  type="number"
                  value={formData.yearlyPrice}
                  onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                  placeholder="150000"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Nombre de lavages *</Label>
                <Input
                  type="number"
                  value={formData.washCount}
                  onChange={(e) => setFormData({ ...formData, washCount: e.target.value })}
                  placeholder="4"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Priorité</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Normale</SelectItem>
                    <SelectItem value="1">Légère</SelectItem>
                    <SelectItem value="2">Priorité</SelectItem>
                    <SelectItem value="3">Maximale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-[#757575]">Lavages bonus</Label>
                <Input
                  type="number"
                  value={formData.bonusWashes}
                  onChange={(e) => setFormData({ ...formData, bonusWashes: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Options gratuites</Label>
                <Input
                  type="number"
                  value={formData.freeOptions}
                  onChange={(e) => setFormData({ ...formData, freeOptions: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.includesExpress}
                  onCheckedChange={(v) => setFormData({ ...formData, includesExpress: v })}
                />
                <Label className="text-xs text-[#757575]">Service express inclus</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.includesVip}
                  onCheckedChange={(v) => setFormData({ ...formData, includesVip: v })}
                />
                <Label className="text-xs text-[#757575]">Accès VIP</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label className="text-xs text-[#757575]">Actif</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingPlan ? 'Mettre à jour' : 'Créer'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`border-0 shadow-sm ${!plan.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-[#212121]">{plan.displayName}</h3>
                      <Badge variant="outline" className="text-xs">{plan.name}</Badge>
                      <Badge className={plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {plan.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-[#757575] mt-1">{plan.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#757575]">
                      <span><strong>Service:</strong> {plan.service?.name || 'N/A'}</span>
                      <span><strong>Lavages:</strong> {plan.washCount}</span>
                      <span><strong>Priorité:</strong> {getPriorityLabel(plan.priority)}</span>
                      <span><strong>Abonnés:</strong> {plan.subscribersCount}</span>
                    </div>
                    {plan.bonusWashes > 0 && (
                      <span className="text-xs text-[#4CAF50] mt-1 block">+{plan.bonusWashes} lavage(s) bonus</span>
                    )}
                    {(plan.includesExpress || plan.includesVip) && (
                      <div className="flex gap-2 mt-1">
                        {plan.includesExpress && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Express</Badge>}
                        {plan.includesVip && <Badge className="bg-purple-100 text-purple-800 text-[10px]">VIP</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <p className="font-bold text-[#FF9800] text-lg">{plan.price.toLocaleString()} XOF<span className="text-xs font-normal text-[#757575]">/mois</span></p>
                      {plan.quarterlyPrice && (
                        <p className="text-xs text-[#757575]">{plan.quarterlyPrice.toLocaleString()} XOF /trimestre</p>
                      )}
                      {plan.yearlyPrice && (
                        <p className="text-xs text-[#757575]">{plan.yearlyPrice.toLocaleString()} XOF /an</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(plan)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggleActive(plan)}>
                        {plan.isActive ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </Button>
                      {plan.subscribersCount === 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(plan)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg">
          <Tag className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Aucun forfait configuré</p>
          <Button className="mt-4 bg-[#FF9800] hover:bg-[#F57C00]" onClick={() => setShowForm(true)}>
            Créer un forfait
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le forfait ?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#757575]">
              Êtes-vous sûr de vouloir supprimer le forfait <strong>{deleteConfirm?.displayName}</strong> ?
            </p>
            <p className="text-xs text-red-500 mt-2">Cette action est irréversible.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Subscriptions - Manage subscriptions and session validations
interface SubscriptionData {
  id: string;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  plan: {
    id: string;
    name: string;
    displayName: string;
    service?: { name: string } | null;
  };
  duration: string;
  paidAmount: number;
  totalWashes: number;
  usedWashes: number;
  remainingWashes: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
  recentUsages: Array<{
    id: string;
    status: string;
    usedAt: string;
    serviceName: string;
  }>;
  totalUsages: number;
}

interface SubscriptionUsage {
  id: string;
  subscriptionId: string;
  orderId: string | null;
  usedAt: string;
  serviceName: string;
  washType: string;
  address: string | null;
  status: string;
  validatedAt: string | null;
  validatedBy: string | null;
  adminNotes: string | null;
  subscription: {
    user: {
      id: string;
      name: string;
      phone: string;
    };
    plan: {
      name: string;
      displayName: string;
    };
  };
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    washer?: {
      id: string;
      user: {
        name: string;
        phone: string;
      };
    } | null;
  } | null;
}

function AdminSubscriptions() {
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [usages, setUsages] = useState<SubscriptionUsage[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewMode, setViewMode] = useState<'list' | 'validations'>('validations');
  const [stats, setStats] = useState({
    pendingValidations: 0,
    totalActive: 0,
    totalExpired: 0,
  });
  const [usageStats, setUsageStats] = useState({
    pending: 0,
    validated: 0,
    cancelled: 0,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch subscriptions
      const subRes = await fetch(`/api/admin/subscriptions?status=${statusFilter}`);
      const subData = await subRes.json();
      if (subData.success) {
        setSubscriptions(subData.subscriptions);
        setStats(subData.stats);
      }

      // Fetch pending usages
      const usageRes = await fetch('/api/admin/subscriptions/usages?status=PENDING');
      const usageData = await usageRes.json();
      if (usageData.success) {
        setUsages(usageData.usages);
        setUsageStats(usageData.stats);
      }
    } catch (error) {
      console.error('Fetch subscriptions error:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleValidateUsage = async (usageId: string, action: 'VALIDATE' | 'CANCEL') => {
    try {
      const res = await fetch('/api/admin/subscriptions/usages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usageId, action }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(action === 'VALIDATE' ? 'Séance validée' : 'Séance annulée');
        fetchData();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors du traitement');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      VALIDATED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      VALIDATED: 'Validée',
      CANCELLED: 'Annulée',
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toggle View */}
      <div className="flex bg-[#F5F5F5] rounded-lg p-1">
        <button
          onClick={() => setViewMode('validations')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            viewMode === 'validations'
              ? 'bg-white text-[#FF9800] shadow-sm'
              : 'text-[#757575]'
          }`}
        >
          Validations ({usageStats.pending})
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            viewMode === 'list'
              ? 'bg-white text-[#FF9800] shadow-sm'
              : 'text-[#757575]'
          }`}
        >
          Abonnements ({stats.totalActive})
        </button>
      </div>

      {viewMode === 'validations' ? (
        <>
          {/* Pending Validations */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
            </div>
          ) : usages.length > 0 ? (
            <div className="space-y-3">
              {usages.map((usage) => (
                <Card key={usage.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-[#212121]">
                          {usage.subscription.user.name || 'Client'}
                        </p>
                        <p className="text-sm text-[#757575]">
                          +228 {usage.subscription.user.phone}
                        </p>
                      </div>
                      {getStatusBadge(usage.status)}
                    </div>
                    
                    <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">Plan</span>
                        <span className="text-sm font-medium">{usage.subscription.plan.displayName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">Service</span>
                        <span className="text-sm font-medium">{usage.serviceName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">Date</span>
                        <span className="text-sm font-medium">
                          {new Date(usage.usedAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {usage.order?.washer && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#757575]">Laveur</span>
                          <span className="text-sm font-medium">{usage.order.washer.user.name}</span>
                        </div>
                      )}
                    </div>

                    {usage.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleValidateUsage(usage.id, 'VALIDATE')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Valider
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleValidateUsage(usage.id, 'CANCEL')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Annuler
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-[#4CAF50] mx-auto mb-3" />
              <p className="text-[#757575]">Aucune séance en attente de validation</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actifs ({stats.totalActive})</SelectItem>
              <SelectItem value="expired">Expirés ({stats.totalExpired})</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#4CAF50]">{stats.totalActive}</p>
                <p className="text-xs text-[#757575]">Abonnements actifs</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#FF9800]">{stats.pendingValidations}</p>
                <p className="text-xs text-[#757575]">En attente</p>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {subscriptions.map((sub) => (
                <Card key={sub.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-[#212121]">
                          {sub.user.name || 'Client'}
                        </p>
                        <p className="text-sm text-[#757575]">+228 {sub.user.phone}</p>
                      </div>
                      <Badge className={sub.isActive && !sub.isExpired ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {sub.plan.displayName}
                      </Badge>
                    </div>
                    
                    <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">Séances</span>
                        <span className="text-sm font-medium">
                          {sub.remainingWashes} / {sub.totalWashes} restantes
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">Expire le</span>
                        <span className="text-sm font-medium">
                          {new Date(sub.endDate).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-[#4CAF50] h-2 rounded-full"
                          style={{ width: `${(sub.remainingWashes / sub.totalWashes) * 100}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Tag className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
              <p className="text-[#757575]">Aucun abonnement trouvé</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
