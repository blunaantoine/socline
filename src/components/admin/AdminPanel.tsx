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
  RefreshCw, Loader2, ArrowLeft, LogOut, Percent, Wallet, Phone, Image as ImageIcon, Move
} from 'lucide-react';
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

export function AdminPanel() {
  const { user, logout } = useAuthStore();
  const { setView } = useAppStore();
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'washers') {
      fetchWashers();
    } else if (activeTab === 'promotions') {
      fetchPromotions();
    } else if (activeTab === 'deposits') {
      fetchDeposits();
    }
  }, [activeTab, fetchStats, fetchOrders, fetchUsers, fetchWashers, fetchPromotions, fetchDeposits]);

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
        <span className="text-white text-xs font-medium">9:41</span>
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
      <div className="flex-1 overflow-y-auto pb-28">
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
        {activeTab === 'settings' && <AdminSettings />}
      </div>

      {/* Android Bottom Navigation - FIXED at bottom */}
      <nav className="fixed bottom-10 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-center h-14 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'users', icon: Users, label: 'Utilis.' },
          { id: 'orders', icon: Clock, label: 'Commandes' },
          { id: 'promotions', icon: Tag, label: 'Promos' },
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
                <p className="text-xl font-bold text-[#4CAF50]">{stats.todayRevenue.toLocaleString()} F</p>
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
                  <p className="font-bold text-[#FF9800]">{order.amount.toLocaleString()} F</p>
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
                    <p className="font-bold text-[#FF9800]">{order.amount.toLocaleString()} F</p>
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
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-blue-600">
            {displayUsers.filter(u => u.role === 'CLIENT').length}
          </div>
          <div className="text-xs text-blue-800">Clients</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-orange-600">
            {displayUsers.filter(u => u.role === 'WASHER').length}
          </div>
          <div className="text-xs text-orange-800">Laveurs</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
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
                    <span className="text-green-600 font-medium">{user.washer.totalEarnings.toLocaleString()} F</span>
                  </div>
                )}
                
                {/* Wallet balance for clients */}
                {user.role === 'CLIENT' && (
                  <div className="mt-2 pt-2 border-t border-[#F5F5F5] flex justify-between text-xs">
                    <span className="text-[#757575]">{user.orders} commandes</span>
                    <span className="text-green-600 font-medium">
                      Solde: {(user.walletBalance || 0).toLocaleString()} F
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
                placeholder="Ex: 90123456"
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
                placeholder="Ex: 90123456"
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
        <h2 className="font-semibold text-lg text-[#212121]">Laveurs</h2>
        <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
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
                  <span className="font-medium text-[#4CAF50]">{washer.earnings.toLocaleString()} F gagnés</span>
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
                    <p className="font-bold text-[#FF9800] text-lg">{service.price.toLocaleString()} F</p>
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
            <p className="text-xl font-bold text-[#4CAF50]">
              {stats?.totalRevenue?.toLocaleString() || 0} F
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#757575]">Ce mois</p>
            <p className="text-xl font-bold text-[#2196F3]">
              {stats?.monthRevenue?.toLocaleString() || 0} F
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#757575]">Commissions (15%)</p>
              <p className="text-xl font-bold text-[#FF9800]">
                {((stats?.totalRevenue || 0) * 0.15).toLocaleString()} F
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#FF9800]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Settings
function AdminSettings() {
  const { logout } = useAuthStore();
  const [activeSection, setActiveSection] = useState<'general' | 'users' | 'operators'>('general');
  const [operators, setOperators] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingOperator, setEditingOperator] = useState<any>(null);
  const [showOperatorForm, setShowOperatorForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormType, setUserFormType] = useState<'client' | 'washer'>('client');
  const [userSearch, setUserSearch] = useState('');
  const [operatorForm, setOperatorForm] = useState({
    name: '',
    displayName: '',
    ussdPattern: '',
    recipientNumber: '',
    color: '#FF9800',
    minAmount: '100',
    maxAmount: '500000',
    isActive: true,
  });
  const [userForm, setUserForm] = useState({
    name: '',
    phone: '',
    email: '',
    pin: '1234',
    role: 'CLIENT' as 'CLIENT' | 'WASHER',
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

  const fetchAllUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users?limit=50');
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'operators') {
      fetchOperators();
    } else if (activeSection === 'users') {
      fetchAllUsers();
    }
  }, [activeSection, fetchOperators, fetchAllUsers]);

  // User management functions
  const handleCreateUser = async () => {
    if (!userForm.phone) {
      toast.error('Le téléphone est requis');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userForm,
          createWasher: userForm.role === 'WASHER',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(userForm.role === 'WASHER' ? 'Laveur créé avec succès' : 'Client créé avec succès');
        setShowUserForm(false);
        resetUserForm();
        fetchAllUsers();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };

  const handleCreateWasher = async () => {
    if (!userForm.phone) {
      toast.error('Le téléphone est requis');
      return;
    }

    try {
      const res = await fetch('/api/admin/washers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Laveur créé avec succès');
        setShowUserForm(false);
        resetUserForm();
        fetchAllUsers();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !isActive }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
        fetchAllUsers();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handlePromoteToWasher = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'WASHER' }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Utilisateur promu laveur');
        fetchAllUsers();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const resetUserForm = () => {
    setUserForm({
      name: '',
      phone: '',
      email: '',
      pin: '1234',
      role: 'CLIENT',
    });
    setUserFormType('client');
  };

  const handleSaveOperator = async () => {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOperator?.id,
          ...operatorForm,
          minAmount: parseInt(operatorForm.minAmount),
          maxAmount: parseInt(operatorForm.maxAmount),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingOperator ? 'Opérateur mis à jour' : 'Opérateur créé');
        setShowOperatorForm(false);
        setEditingOperator(null);
        resetOperatorForm();
        fetchOperators();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEditOperator = (op: any) => {
    setEditingOperator(op);
    setOperatorForm({
      name: op.name,
      displayName: op.displayName,
      ussdPattern: op.ussdPattern,
      recipientNumber: op.recipientNumber,
      color: op.color,
      minAmount: op.minAmount.toString(),
      maxAmount: op.maxAmount.toString(),
      isActive: op.isActive,
    });
    setShowOperatorForm(true);
  };

  const handleDeleteOperator = async (id: string) => {
    if (!confirm('Supprimer cet opérateur ?')) return;
    
    try {
      const res = await fetch(`/api/operators?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Opérateur supprimé');
        fetchOperators();
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetOperatorForm = () => {
    setOperatorForm({
      name: '',
      displayName: '',
      ussdPattern: '',
      recipientNumber: '',
      color: '#FF9800',
      minAmount: '100',
      maxAmount: '500000',
      isActive: true,
    });
    setEditingOperator(null);
  };

  const handleToggleOperator = async (op: any) => {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: op.id,
          isActive: !op.isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(op.isActive ? 'Opérateur désactivé' : 'Opérateur activé');
        fetchOperators();
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.phone.includes(userSearch)
  );

  return (
    <div className="p-4 space-y-4 pb-28">
      <h2 className="font-semibold text-lg text-[#212121]">Paramètres</h2>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        <Button
          variant={activeSection === 'general' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('general')}
          className={activeSection === 'general' ? 'bg-[#FF9800] hover:bg-[#F57C00]' : ''}
        >
          Général
        </Button>
        <Button
          variant={activeSection === 'users' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('users')}
          className={activeSection === 'users' ? 'bg-[#FF9800] hover:bg-[#F57C00]' : ''}
        >
          <Users className="w-4 h-4 mr-1" />
          Utilisateurs
        </Button>
        <Button
          variant={activeSection === 'operators' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('operators')}
          className={activeSection === 'operators' ? 'bg-[#FF9800] hover:bg-[#F57C00]' : ''}
        >
          <Phone className="w-4 h-4 mr-1" />
          Opérateurs
        </Button>
      </div>

      {activeSection === 'general' && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-xs text-[#757575]">Nom de l&apos;entreprise</Label>
                <Input defaultValue="Socline" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Téléphone</Label>
                <Input defaultValue="+228 90 12 34 56" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-[#757575]">Commission (%)</Label>
                <Input type="number" defaultValue="15" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Button className="w-full bg-[#FF9800] hover:bg-[#F57C00]">
            Enregistrer
          </Button>

          <Button
            onClick={logout}
            variant="outline"
            className="w-full border-red-200 text-red-500 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </>
      )}

      {activeSection === 'users' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#757575]">Gérer les utilisateurs et laveurs</p>
            <Button
              size="sm"
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={() => {
                resetUserForm();
                setShowUserForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setUserFormType('client');
                setUserForm(prev => ({ ...prev, role: 'CLIENT' }));
                setShowUserForm(true);
              }}
            >
              <Users className="w-4 h-4 mr-1" />
              Nouveau client
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setUserFormType('washer');
                setUserForm(prev => ({ ...prev, role: 'WASHER' }));
                setShowUserForm(true);
              }}
            >
              <Car className="w-4 h-4 mr-1" />
              Nouveau laveur
            </Button>
          </div>

          {/* User Creation Form */}
          {showUserForm && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-[#212121] flex items-center gap-2">
                  {userFormType === 'washer' ? (
                    <>
                      <Car className="w-4 h-4 text-[#FF9800]" />
                      Nouveau laveur
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-[#FF9800]" />
                      Nouveau client
                    </>
                  )}
                </h3>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-[#757575]">Téléphone *</Label>
                    <Input
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      placeholder="90123456"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Nom complet</Label>
                    <Input
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      placeholder="Jean Dupont"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Email (optionnel)</Label>
                    <Input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Code PIN</Label>
                    <Input
                      type="password"
                      maxLength={4}
                      value={userForm.pin}
                      onChange={(e) => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="1234"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                    onClick={userFormType === 'washer' ? handleCreateWasher : handleCreateUser}
                  >
                    Créer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUserForm(false);
                      resetUserForm();
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <Card key={user.id} className={`border-0 shadow-sm ${!user.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-[#E3F2FD] text-[#2196F3]">
                          {user.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-[#212121] text-sm truncate">{user.name || 'N/A'}</h3>
                          <Badge className="bg-[#E3F2FD] text-[#2196F3] text-[10px]">Client</Badge>
                        </div>
                        <p className="text-xs text-[#757575]">{user.phone}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handlePromoteToWasher(user.id)}
                          title="Promouvoir en laveur"
                        >
                          <Car className="w-4 h-4 text-[#FF9800]" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                        >
                          {user.isActive ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </div>
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
        </>
      )}

      {activeSection === 'operators' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#757575]">Configuration des opérateurs Mobile Money</p>
            <Button
              size="sm"
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={() => {
                resetOperatorForm();
                setShowOperatorForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {/* Operator Form */}
          {showOperatorForm && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-[#212121]">
                  {editingOperator ? 'Modifier l&apos;opérateur' : 'Nouvel opérateur'}
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#757575]">Nom court</Label>
                    <Input
                      value={operatorForm.name}
                      onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                      placeholder="Mixx by Yas"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Nom complet</Label>
                    <Input
                      value={operatorForm.displayName}
                      onChange={(e) => setOperatorForm({ ...operatorForm, displayName: e.target.value })}
                      placeholder="Mixx by Yas (Togo Telecom)"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-[#757575]">Pattern USSD</Label>
                  <Input
                    value={operatorForm.ussdPattern}
                    onChange={(e) => setOperatorForm({ ...operatorForm, ussdPattern: e.target.value })}
                    placeholder="*145*1*{montant}*{numero}*2#"
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-[10px] text-[#9E9E9E] mt-1">
                    Utilisez {'{montant}'} et {'{numero}'} comme variables
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#757575]">Numéro destinataire</Label>
                    <Input
                      value={operatorForm.recipientNumber}
                      onChange={(e) => setOperatorForm({ ...operatorForm, recipientNumber: e.target.value })}
                      placeholder="90000000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Couleur</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="color"
                        value={operatorForm.color}
                        onChange={(e) => setOperatorForm({ ...operatorForm, color: e.target.value })}
                        className="w-10 h-9 p-1"
                      />
                      <Input
                        value={operatorForm.color}
                        onChange={(e) => setOperatorForm({ ...operatorForm, color: e.target.value })}
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
                      value={operatorForm.minAmount}
                      onChange={(e) => setOperatorForm({ ...operatorForm, minAmount: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#757575]">Montant max (F)</Label>
                    <Input
                      type="number"
                      value={operatorForm.maxAmount}
                      onChange={(e) => setOperatorForm({ ...operatorForm, maxAmount: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={operatorForm.isActive}
                    onCheckedChange={(v) => setOperatorForm({ ...operatorForm, isActive: v })}
                  />
                  <Label className="text-xs text-[#757575]">Actif</Label>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                    onClick={handleSaveOperator}
                  >
                    {editingOperator ? 'Mettre à jour' : 'Créer'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowOperatorForm(false);
                      resetOperatorForm();
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operators List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
            </div>
          ) : operators.length > 0 ? (
            <div className="space-y-3">
              {operators.map((op) => (
                <Card key={op.id} className={`border-0 shadow-sm ${!op.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: op.color }}
                      >
                        {op.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-[#212121]">{op.displayName}</h3>
                          <Badge className={op.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {op.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#757575] font-mono">{op.ussdPattern}</p>
                        <p className="text-xs text-[#9E9E9E]">Destinataire: {op.recipientNumber}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditOperator(op)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleOperator(op)}
                        >
                          {op.isActive ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteOperator(op.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Phone className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
              <p className="text-[#757575]">Aucun opérateur configuré</p>
              <Button
                className="mt-4 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={() => setShowOperatorForm(true)}
              >
                Ajouter un opérateur
              </Button>
            </div>
          )}
        </>
      )}
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
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Promotions</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={isLoading} className="text-[#FF9800]">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Button 
            size="sm" 
            className="bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle
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
                <div className="flex gap-3">
                  {/* Image thumbnail */}
                  {promo.image && (
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <img 
                        src={promo.image} 
                        alt={promo.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: promo.imagePosition || 'center' }}
                      />
                    </div>
                  )}
                  <div className="flex-1 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#FF9800]" />
                        <h3 className="font-medium text-[#212121]">{promo.name}</h3>
                      </div>
                      {promo.description && (
                        <p className="text-xs text-[#757575] mt-1">{promo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
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
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={
                        isPromoActive(promo) 
                          ? 'bg-green-100 text-green-800' 
                          : promo.isActive 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }>
                        {isPromoActive(promo) ? 'Active' : promo.isActive ? 'À venir' : 'Inactive'}
                      </Badge>
                      <div className="flex gap-1">
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
                    <p className="text-xl font-bold text-[#FF9800]">{deposit.amount.toLocaleString()} F</p>
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
