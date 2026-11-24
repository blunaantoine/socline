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
  LayoutDashboard, Users, Car, Car as CarIcon, MapPin, DollarSign, 
  TrendingUp, Clock, Star, Settings, Bell, Plus,
  CheckCircle, XCircle, AlertCircle, Search,
  ChevronDown, Download, Eye, Edit, Trash2, Tag,
  RefreshCw, Loader2, ArrowLeft, LogOut, Percent, Wallet, Phone, Image as ImageIcon, Move, Banknote, Receipt, Video as VideoIcon, Film, Building2, CreditCard, Copy, Headphones
} from 'lucide-react';
import { AdminSupportTickets } from '@/components/admin/AdminSupportTickets';
import { AdminCompanies } from '@/components/admin/AdminCompanies';
import { HideableBalanceLight } from '@/components/ui/hideable-balance';
import { toast } from 'sonner';
import { parseJsonResponse } from '@/lib/json-helper';
import { useAutoRefresh, type RefreshSource } from '@/hooks/useAutoRefresh';
import { AdminNotificationCenter } from '@/components/admin/AdminNotificationCenter';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';

// Component to drag and position image
// Convention de stockage : CSS object-position standard « X% Y% » (horizontal
// d'abord) — identique côté aperçu admin ET bannière client.
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

  // Dernière fonction onPositionChange (évite de réabonner les listeners
  // globaux à chaque rendu du formulaire pendant le glissement)
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  // Parse position to get x,y percentages (x = horizontal, y = vertical)
  const parsePosition = (pos: string): { x: number; y: number } => {
    if (pos.includes('%')) {
      // Format CSS « X% Y% » : horizontal d'abord
      const parts = pos.split(' ').map(p => parseInt(p.replace('%', '')) || 0);
      return { x: parts[0] ?? 50, y: parts[1] ?? 50 };
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

  // Un clic simple sur l'aperçu ne doit PAS rouvrir le sélecteur de fichier
  // (l'aperçu vit dans un <label> qui contient l'input). Le changement
  // d'image passe par le bouton de suppression.
  const swallowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      // Format CSS « X% Y% » : horizontal d'abord
      onPositionChangeRef.current(`${Math.round(x)}% ${Math.round(y)}%`);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault(); // le glissement déplace l'image, pas la page
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const pos = parsePosition(position);

  return (
    <div className="relative w-full h-full">
      {/* Instructions */}
      <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
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
        className="w-full h-full cursor-move overflow-hidden rounded-lg relative select-none touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={swallowClick}
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
          <div className={`w-4 h-4 border-2 border-white rounded-full ${isDragging ? 'bg-brand-ink/50' : 'bg-transparent'} shadow-lg`} />
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
  // Vehicle identification + wash verification photos (admin verification)
  car?: {
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    plateNumber?: string | null;
    photo?: string | null;
  } | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  payment?: { method?: string; status?: string; amount?: number } | null;
  review?: { rating?: number; comment?: string | null } | null;
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
  // Commission espèces à recouvrer (retournée par GET /api/admin/washers)
  cashDebt?: number;
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
  video?: string | null;
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
  provider?: string | null; // "PAYDUNYA" = validation automatique par PayDunya
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
  // Clavier virtuel ouvert → barre du bas masquée (sinon elle remonte collée au clavier)
  const keyboardOpen = useKeyboardOpen();
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
  // Stations de lavage — gérées séparément des laveurs indépendants
  const [stations, setStations] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState<string | null>(null); // For "Plus" menu sub-navigation

  // Fetch dashboard stats — `background` : rafraîchissement silencieux (auto-sync)
  const fetchStats = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');

      if (res.status === 401) {
        toast.error('Session expirée, veuillez vous reconnecter');
        logout();
        return;
      }

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setStats(data.stats);
        setRevenueByDay(data.charts.revenueByDay);
        setOrdersByService(data.charts.ordersByService);
        setRecentOrders(data.recentOrders);
      } else if (!background) {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
      if (!background) toast.error('Erreur lors du chargement des statistiques');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [logout]);

  // Fetch orders — `background` : rafraîchissement silencieux (auto-sync)
  const fetchOrders = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search: searchQuery,
      });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Fetch users — `background` : rafraîchissement silencieux (auto-sync)
  const fetchUsers = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: searchQuery });
      const res = await fetch(`/api/admin/users?${params}`);

      if (res.status === 401) {
        toast.error('Session expirée, veuillez vous reconnecter');
        logout();
        return;
      }

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setUsers(data.users);
      } else if (!background) {
        toast.error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      if (!background) toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [searchQuery, logout]);

  // Fetch washers — `background` : rafraîchissement silencieux (auto-sync)
  const fetchWashers = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/washers');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setWashers(data.washers);
      }
    } catch (error) {
      console.error('Fetch washers error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Fetch promotions — `background` : rafraîchissement silencieux (auto-sync)
  const fetchPromotions = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/promotions');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Fetch promotions error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Fetch deposits — `background` : rafraîchissement silencieux (auto-sync)
  const fetchDeposits = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/deposits?status=PENDING');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setDeposits(data.deposits);
      }
    } catch (error) {
      console.error('Fetch deposits error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Fetch withdrawals — `background` : rafraîchissement silencieux (auto-sync)
  const fetchWithdrawals = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/withdrawals?status=PENDING');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setWithdrawals(data.withdrawals);
      }
    } catch (error) {
      console.error('Fetch withdrawals error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Fetch stations — liste admin des stations de lavage
  const fetchStations = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/stations');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setStations(data.stations);
      }
    } catch (error) {
      console.error('Fetch stations error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Rafraîchit les données de l'onglet actif. `source` distingue le chargement
  // initial (spinner) du rafraîchissement automatique (silencieux).
  const refreshActiveTab = useCallback((source: RefreshSource = 'initial') => {
    const background = source !== 'initial';
    if (activeTab === 'dashboard') {
      fetchStats(background);
    } else if (activeTab === 'orders') {
      fetchOrders(background);
    } else if (activeTab === 'users') {
      fetchUsers(background);
    } else if (activeTab === 'washers') {
      fetchWashers(background);
    } else if (activeTab === 'settings') {
      // Load data based on subTab
      if (subTab === 'promotions') {
        fetchPromotions(background);
      } else if (subTab === 'deposits') {
        fetchDeposits(background);
      } else if (subTab === 'withdrawals') {
        fetchWithdrawals(background);
      } else if (subTab === 'stations') {
        fetchStations(background);
      } else if (subTab === 'operators') {
        // Operators are loaded in AdminSettings
      }
    } else if (activeTab === 'promotions') {
      fetchPromotions(background);
    } else if (activeTab === 'deposits') {
      fetchDeposits(background);
    }
  }, [activeTab, subTab, fetchStats, fetchOrders, fetchUsers, fetchWashers, fetchPromotions, fetchDeposits, fetchWithdrawals, fetchStations]);

  // Auto-sync : rafraîchit l'onglet actif toutes les 30 s, au retour sur
  // l'app et à chaque changement d'onglet/filtre (chargement visible).
  useAutoRefresh(refreshActiveTab, 30000);

  // Badges de notification (rechargements/retraits en attente) — toujours à
  // jour via rafraîchissement silencieux toutes les 45 s + retour sur l'app.
  const refreshBadges = useCallback((source: RefreshSource = 'initial') => {
    fetchDeposits(source !== 'initial');
    fetchWithdrawals(source !== 'initial');
  }, [fetchDeposits, fetchWithdrawals]);

  useAutoRefresh(refreshBadges, 45000);

  // Handle washer verification
  const handleVerifyWasher = async (washerId: string, action: 'verify' | 'reject') => {
    try {
      const res = await fetch('/api/admin/washers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ washerId, action }),
      });
      
      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
      if (data.success) {
        toast.success(action === 'verify' ? 'Laveur vérifié' : 'Laveur rejeté');
        fetchWashers();
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Handle station management actions (activer/désactiver, vérifier le propriétaire)
  const handleStationAction = async (stationId: string, action: 'toggle-active' | 'verify-owner' | 'reject-owner') => {
    try {
      const res = await fetch('/api/admin/stations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, action }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
      if (data.success) {
        toast.success(data.message || 'Station mise à jour');
        fetchStations();
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
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
      
      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
      if (data.success) {
        // Le serveur fournit un message précis (ex : statut PayDunya)
        toast.success(data.message || (action === 'validate' ? 'Rechargement validé' : 'Rechargement rejeté'));
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
      
      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
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
      PENDING: 'bg-amber-50 text-amber-800',
      ACCEPTED: 'bg-app text-ink',
      EN_ROUTE: 'bg-app text-ink',
      ARRIVED: 'bg-app text-ink',
      IN_PROGRESS: 'bg-app text-ink',
      COMPLETED: 'bg-success/10 text-success',
      CANCELLED: 'bg-red-50 text-red-700',
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
    <div className="flex-1 flex flex-col bg-app overflow-hidden">
      {/* Android Status Bar — aperçu desktop uniquement */}
      <div className="h-6 bg-ink hidden md:flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
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

      {/* Header — sur mobile il colle au haut (pas de barre factice) + safe-area */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0 sticky top-0 md:top-6 z-40 max-md:pt-[calc(0.75rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink rounded-full flex items-center justify-center text-white text-base font-bold">
              A
            </div>
            <div>
              <div className="font-semibold text-ink">Admin</div>
              <div className="text-xs text-soft">{user?.name || 'Socline'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminNotificationCenter />
            <Button variant="outline" size="icon" onClick={logout} className="text-soft hover:text-red-600 border-line" aria-label="Déconnexion">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-[calc(4.5rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
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
            // Sous-écran : barre titre + retour, puis le contenu (qui a sa propre
            // marge p-4 — pas de double marge) ; le titre interne en double est masqué.
            <div className="[&>section>div>div:first-child>h2:first-child]:hidden [&>section>div>h2:first-child]:hidden [&>section>div>div:first-child:has(>h2:first-child)]:justify-end">
              <div className="flex items-center gap-2 px-4 pt-4">
                <button
                  onClick={() => setSubTab(null)}
                  className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-app"
                  aria-label="Retour au menu"
                >
                  <ArrowLeft className="w-5 h-5 text-ink" />
                </button>
                <h2 className="font-semibold text-lg text-ink truncate">
                  {subTab === 'companies' && 'Entreprises'}
                  {subTab === 'deposits' && 'Demandes de recharge'}
                  {subTab === 'withdrawals' && 'Retraits Laveurs'}
                  {subTab === 'stations' && 'Stations de Lavage'}
                  {subTab === 'transactions' && 'Historique des transactions'}
                  {subTab === 'subscription-plans' && 'Forfaits Abonnements'}
                  {subTab === 'subscriptions' && 'Abonnements Clients'}
                  {subTab === 'promotions' && 'Promotions'}
                  {subTab === 'support' && 'Support Clients (assistant Soco)'}
                  {subTab === 'services' && 'Services'}
                  {subTab === 'finances' && 'Finances'}
                  {subTab === 'operators' && 'Opérateurs Mobile Money'}
                  {subTab === 'payment-system' && 'Système de Paiement'}
                  {subTab === 'settings' && 'Paramètres'}
                </h2>
              </div>
              <section className="p-4 [&>div]:!p-0">
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
              {subTab === 'stations' && (
                <AdminStations
                  stations={stations}
                  isLoading={isLoading}
                  onRefresh={fetchStations}
                  onAction={handleStationAction}
                />
              )}
              {subTab === 'transactions' && <AdminTransactions />}
              {subTab === 'support' && <AdminSupportTickets />}
              {subTab === 'companies' && <AdminCompanies />}
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
              {subTab === 'payment-system' && <AdminPaymentSystem />}
              {subTab === 'settings' && <AdminSettingsContent />}
              </section>
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

      {/* Android Bottom Navigation - FIXED at bottom (safe-area iOS incluse) */}
      <nav className={`fixed bottom-0 left-0 right-0 bg-white border-t border-line flex justify-around items-stretch h-[calc(3.5rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))] pb-[max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px))] z-50${keyboardOpen ? ' hidden' : ''}`}>
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
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 active:bg-app ${
                isActive ? 'text-brand-ink' : 'text-soft'
              }`}
            >
              <tab.icon className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
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
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin mx-auto" />
          <p className="text-sm text-soft mt-2">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="text-center p-4">
          <AlertCircle className="w-12 h-12 text-brand-ink mx-auto mb-3" />
          <p className="text-soft mb-3">Impossible de charger les statistiques</p>
          <Button onClick={onRefresh} variant="outline" className="text-brand-ink border-brand-ink">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-ink">Dashboard</h2>
        <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-xs text-soft">Commandes aujourd&apos;hui</p>
                <p className="text-xl font-bold text-ink">{stats.todayOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-xs text-soft">Revenus aujourd&apos;hui</p>
                <HideableBalanceLight
                  balance={stats.todayRevenue}
                  currency="XOF"
                  size="md"
                  storageKey="hide-admin-today-revenue"
                  balanceClassName="text-ink"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app rounded-full flex items-center justify-center">
                <Car className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-xs text-soft">Laveurs actifs</p>
                <p className="text-xl font-bold text-ink">{stats.activeWashers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-ink" />
              </div>
              <div>
                <p className="text-xs text-soft">Clients</p>
                <p className="text-xl font-bold text-ink">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-semibold text-sm text-ink mb-3">Aperçu rapide</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-ink">{stats.pendingOrders}</div>
            <div className="text-xs text-soft">En attente</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-ink">{stats.inProgressOrders}</div>
            <div className="text-xs text-soft">En cours</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-ink">{stats.completedOrders}</div>
            <div className="text-xs text-soft">Terminées</div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <Card className="border border-line shadow-none">
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
                    className="w-full bg-ink/85 rounded-t"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-soft">{item.day}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="border border-line shadow-none">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Commandes récentes</CardTitle>
          <span className="text-xs text-brand-ink">{recentOrders.length} commandes</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#F5F5F5]">
            {recentOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-soft">{order.id}</span>
                    <Badge className={
                      order.status === 'COMPLETED' ? 'bg-success/10 text-success' :
                      order.status === 'IN_PROGRESS' ? 'bg-app text-ink' :
                      order.status === 'PENDING' ? 'bg-amber-50 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {order.status === 'COMPLETED' && 'Terminée'}
                      {order.status === 'IN_PROGRESS' && 'En cours'}
                      {order.status === 'PENDING' && 'En attente'}
                      {order.status === 'ACCEPTED' && 'Acceptée'}
                      {order.status === 'EN_ROUTE' && 'En route'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-ink mt-1">{order.client}</p>
                  <p className="text-xs text-soft">{order.service}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ink tabular-nums">{order.amount.toLocaleString()} XOF</p>
                  <p className="text-xs text-soft">{order.time}</p>
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
        <h2 className="font-semibold text-lg text-ink">Commandes</h2>
        <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
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
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div>
                    <span className="font-mono text-xs text-soft">{order.orderNumber}</span>
                    <h3 className="font-medium text-ink">{order.client}</h3>
                    <p className="text-xs text-soft">{order.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink tabular-nums">{order.amount.toLocaleString()} XOF</p>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-soft">
                  <span>{order.washer && order.washer !== '-' ? `Laveur : ${order.washer}` : 'Sans laveur'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                  {order.payment?.method && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={order.payment.method === 'CASH' ? 'font-medium text-ink' : ''}>
                        {order.payment.method === 'CASH' ? 'Espèces' : 'Portefeuille'}
                        {order.payment.status === 'PENDING' ? ' (à encaisser)' : ''}
                      </span>
                    </>
                  )}
                </div>

                {/* Vehicle identification */}
                {order.car && (
                  <div className="mt-2 flex items-center gap-2 text-xs bg-app rounded-lg px-2 py-1.5 w-fit">
                    <CarIcon className="w-3.5 h-3.5 text-soft" />
                    <span className="text-soft">
                      {[order.car.brand, order.car.model, order.car.color].filter(Boolean).join(' ')}
                      <span className="font-mono text-success"> • {order.car.plateNumber}</span>
                    </span>
                  </div>
                )}

                {/* Wash verification photos — before/after proof */}
                {(order.beforePhotoUrl || order.afterPhotoUrl) && (
                  <div className="mt-2 flex gap-2">
                    {order.beforePhotoUrl && (
                      <a href={order.beforePhotoUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={order.beforePhotoUrl}
                          alt={`Photo avant lavage ${order.orderNumber}`}
                          className="w-16 h-12 object-cover rounded-md border hover:opacity-80"
                        />
                        <span className="text-[9px] text-soft block">Avant</span>
                      </a>
                    )}
                    {order.afterPhotoUrl && (
                      <a href={order.afterPhotoUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={order.afterPhotoUrl}
                          alt={`Photo après lavage ${order.orderNumber}`}
                          className="w-16 h-12 object-cover rounded-md border hover:opacity-80"
                        />
                        <span className="text-[9px] text-soft block">Après</span>
                      </a>
                    )}
                    {order.review?.rating ? (
                      <div className="self-center text-xs text-soft">
                        ⭐ {order.review.rating}/5
                        {order.review.comment ? <span className="block max-w-[160px] truncate">“{order.review.comment}”</span> : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Clock className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucune commande trouvée</p>
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
  const currentAdminId = useAuthStore((st) => st.user?.id);
  // Suppression : aperçu (commandes, solde), motif et blocage du numéro.
  const [deletePreview, setDeletePreview] = useState<{ orders: number; activeOrders: number; walletBalance: number } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBlock, setDeleteBlock] = useState(false);
  useEffect(() => {
    if (!deleteConfirm) return;
    let cancelled = false;
    setDeletePreview(null);
    setDeleteReason('');
    setDeleteBlock(false);
    fetch(`/api/admin/users?userId=${deleteConfirm.id}&preview=1`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.success) setDeletePreview(d.preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [deleteConfirm]);
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
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
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

      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
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

      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }
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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        toast.success(user.isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
        fetchUsersWithFilter();
      } else {
        toast.error(data.error || 'Erreur lors de la modification');
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
      const params = new URLSearchParams({ userId: deleteConfirm.id });
      if (deleteBlock) params.set('block', '1');
      if (deleteReason.trim()) params.set('reason', deleteReason.trim());
      const res = await fetch(`/api/admin/users?${params}`, {
        method: 'DELETE',
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        const sm = data.summary || {};
        const details = [
          sm.cancelledOrders ? `${sm.cancelledOrders} commande(s) annulée(s)` : null,
          sm.releasedOrders ? `${sm.releasedOrders} remise(s) en attente` : null,
          sm.seizedBalance ? `${Math.round(sm.seizedBalance).toLocaleString('fr-FR')} F conservés` : null,
          sm.phoneBlocked ? 'numéro bloqué' : null,
        ].filter(Boolean).join(' · ');
        toast.success('Compte supprimé', details ? { description: details } : undefined);
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
      ADMIN: 'bg-ink text-white',
      WASHER: 'bg-app text-ink border border-line',
      CLIENT: 'bg-app text-ink border border-line',
      COMPANY: 'bg-app text-ink border border-line',
    };
    const labels: Record<string, string> = {
      ADMIN: 'Admin',
      WASHER: 'Laveur',
      CLIENT: 'Client',
      COMPANY: 'Entreprise',
    };
    return <Badge className={styles[role] || 'bg-gray-100 text-gray-800'}>{labels[role] || role}</Badge>;
  };

  // Get avatar color based on role
  const getAvatarColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-ink text-white',
    };
    return colors[role] || 'bg-app text-ink';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg text-ink">Utilisateurs</h2>
        <button
          onClick={fetchUsersWithFilter}
          disabled={isLoading || isSaving}
          className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || isSaving) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Création rapide : 3 boutons de même largeur, libellés courts (ne débordent pas en 360 px) */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { role: 'CLIENT', label: 'Client', icon: Users },
          { role: 'WASHER', label: 'Laveur', icon: Car },
          { role: 'ADMIN', label: 'Admin', icon: Settings },
        ] as const).map((b) => (
          <Button
            key={b.role}
            size="sm"
            variant="outline"
            className="h-10 border-line bg-white text-ink hover:bg-app font-medium px-2"
            onClick={() => {
              setNewUser({ name: '', phone: '', email: '', pin: '1234', role: b.role });
              setShowAddModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="truncate">{b.label}</span>
          </Button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
          <Input
            placeholder="Nom ou téléphone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white h-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-28 bg-white h-10">
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

      {/* Compteurs (filtres rapides) */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { role: 'CLIENT', label: 'Clients' },
          { role: 'WASHER', label: 'Laveurs' },
          { role: 'ADMIN', label: 'Admins' },
        ] as const).map((t) => {
          const active = roleFilter === t.role;
          return (
            <button
              key={t.role}
              onClick={() => setRoleFilter(active ? 'all' : t.role)}
              className={`rounded-lg border p-2 text-center transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-app'}`}
            >
              <div className="text-lg font-bold tabular-nums">{displayUsers.filter(u => u.role === t.role).length}</div>
              <div className={`text-xs ${active ? 'text-white/80' : 'text-soft'}`}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Users List */}
      {isLoading || isSaving ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : displayUsers.length > 0 ? (
        <div className="space-y-2">
          {displayUsers.map((user) => (
            <Card key={user.id} className={`border border-line shadow-none py-0 gap-0 ${!user.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={getAvatarColor(user.role)}>
                      {user.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-ink truncate">{user.name || 'N/A'}</h3>
                      {getRoleBadge(user.role)}
                    </div>
                    <p className="text-xs text-soft">{user.phone}</p>
                    {user.email && <p className="text-xs text-soft">{user.email}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-soft hover:text-ink"
                      onClick={() => openEditModal(user)}
                      aria-label={`Modifier ${user.name || ''}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0"
                      onClick={() => handleToggleStatus(user)}
                      aria-label={user.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
                      title={user.isActive ? 'Compte actif — désactiver' : 'Compte désactivé — réactiver'}
                    >
                      {user.isActive ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-soft" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-soft hover:text-red-600"
                      onClick={() => setDeleteConfirm(user)}
                      // Tout compte peut être supprimé, sauf le sien.
                      disabled={user.id === currentAdminId}
                      aria-label={`Supprimer ${user.name || ''}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Additional info for washers */}
                {user.role === 'WASHER' && user.washer && (
                  <div className="mt-2 pt-2 border-t border-line flex justify-between text-xs text-soft">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span>{user.washer.rating > 0 ? user.washer.rating.toFixed(1) : '-'}</span>
                    </div>
                    <span>{user.washer.completedJobs} jobs</span>
                    <span className="text-ink font-medium">{user.washer.totalEarnings.toLocaleString()} XOF</span>
                  </div>
                )}
                
                {/* Wallet balance for clients */}
                {user.role === 'CLIENT' && (
                  <div className="mt-2 pt-2 border-t border-line flex justify-between text-xs">
                    <span className="text-soft">{user.orders} commandes</span>
                    <span className="text-ink font-medium">
                      Solde : {(user.walletBalance || 0).toLocaleString()} XOF
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Users className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucun utilisateur trouvé</p>
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
              className="bg-brand-ink hover:bg-brand-ink-strong"
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
              className="bg-brand-ink hover:bg-brand-ink-strong"
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
          
          <div className="py-2 space-y-3">
            <p className="text-sm text-soft">
              Supprimer le compte de <strong>{deleteConfirm?.name || 'cet utilisateur'}</strong> ({deleteConfirm?.phone}) ?
            </p>
            {deletePreview ? (
              <ul className="text-xs text-soft space-y-1 bg-app rounded-lg p-3">
                <li>• {deletePreview.orders} commande(s) dans l&apos;historique : conservées sous « Compte supprimé ».</li>
                {deletePreview.activeOrders > 0 && (
                  <li className="text-brand-ink">• {deletePreview.activeOrders} commande(s) en cours : annulées (ou remises en attente si c&apos;est un laveur).</li>
                )}
                {deletePreview.walletBalance > 0 && (
                  <li className="text-brand-ink">• Solde du portefeuille : {Math.round(deletePreview.walletBalance).toLocaleString('fr-FR')} F, conservé par Socline.</li>
                )}
                <li>• Nom, numéro, PIN, voitures, adresses et messages effacés ; connexion impossible.</li>
              </ul>
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-soft" />
            )}
            <div>
              <Label htmlFor="delete-reason" className="text-xs">Motif (facultatif)</Label>
              <Input id="delete-reason" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Fraude, comportement abusif, demande du client…" className="h-10 mt-1 text-sm" />
            </div>
            <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={deleteBlock} onChange={(e) => setDeleteBlock(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600" />
              <span>
                Bloquer ce numéro
                <span className="block text-xs text-soft">Compte malveillant : il ne pourra plus se réinscrire avec ce numéro.</span>
              </span>
            </label>
            <p className="text-xs text-red-600">Cette action est irréversible.</p>
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
  const [numbersWasher, setNumbersWasher] = useState<{ id: string; name: string } | null>(null);
  // Recouvrement de la commission espèces (déduction du portefeuille laveur)
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const debtors = washers.filter((w) => (w.cashDebt ?? 0) > 0);
  const pendingWashers = washers.filter(w => !w.isVerified);
  const verifiedWashers = washers.filter(w => w.isVerified);

  // Recouvrer la commission espèces d'un laveur depuis son portefeuille.
  const handleRecover = async (washer: Washer) => {
    if (recoveringId) return;
    setRecoveringId(washer.id);
    try {
      const res = await fetch('/api/admin/washers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ washerId: washer.id, action: 'recover-commission' }),
      });
      const data = await parseJsonResponse<any>(res);
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Recouvrement impossible');
        return;
      }
      toast.success(data.message || 'Commission recouvrée ✅');
      onRefresh();
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setRecoveringId(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-ink">Gestion des laveurs</h2>
        <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-line rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-ink tabular-nums">{washers.length}</div>
          <div className="text-xs text-soft">Total</div>
        </div>
        <div className="bg-white border border-line rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-ink tabular-nums">{washers.filter(w => w.isAvailable && w.isVerified).length}</div>
          <div className="text-xs text-soft">En ligne</div>
        </div>
        <div className="bg-white border border-line rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-ink tabular-nums">{pendingWashers.length}</div>
          <div className="text-xs text-soft">À vérifier</div>
        </div>
      </div>

      {/* Commission espèces en attente de recouvrement (encaissements CASH) */}
      {debtors.length > 0 && (
        <div className="bg-brand-wash border border-line rounded-lg p-3 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-brand-ink flex-shrink-0" />
          <p className="text-xs text-brand-ink">
            <b>{debtors.length}</b> laveur{debtors.length > 1 ? 's' : ''} avec commission espèces à recouvrer — total :{' '}
            <b>{debtors.reduce((s, w) => s + (w.cashDebt ?? 0), 0).toLocaleString()} XOF</b>
          </p>
        </div>
      )}

      {/* Pending Verifications */}
      {pendingWashers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4" />
              En attente de vérification ({pendingWashers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWashers.map((washer) => (
              <div key={washer.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-brand-wash text-brand-ink">
                      {washer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-ink">{washer.name}</p>
                    <p className="text-xs text-soft">{washer.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-brand-ink hover:bg-brand-ink-strong"
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
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : verifiedWashers.length > 0 ? (
        <div className="space-y-3">
          {verifiedWashers.map((washer) => (
            <Card key={washer.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-success/10 text-success">
                      {washer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-medium text-ink">{washer.name}</h3>
                    <p className="text-xs text-soft">{washer.phone}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{washer.rating > 0 ? washer.rating.toFixed(1) : '-'}</span>
                    </div>
                    <Badge className={washer.isAvailable ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-800'}>
                      {washer.isAvailable ? 'En ligne' : 'Hors ligne'}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-line text-xs text-soft">
                  <span>{washer.completedJobs} jobs</span>
                  <span className="font-medium text-ink">{washer.earnings.toLocaleString()} XOF gagnés</span>
                </div>
                {/* Commission espèces à recouvrer — le laveur a encaissé le cash */}
                {(washer.cashDebt ?? 0) > 0 && (
                  <div className="mt-3 rounded-lg border-2 border-brand-ink bg-brand-wash p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-brand-ink">💵 Commission espèces à recouvrer</p>
                        <p className="text-lg font-bold text-brand-ink">{(washer.cashDebt ?? 0).toLocaleString()} XOF</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-brand-ink hover:bg-brand-ink-strong text-white font-semibold"
                        disabled={recoveringId === washer.id}
                        onClick={() => handleRecover(washer)}
                      >
                        {recoveringId === washer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Recouvrer'
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-soft mt-1">
                      Déduite du portefeuille du laveur — ses retraits sont bloqués tant que la dette n'est pas soldée.
                    </p>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3 border-line text-ink hover:bg-app"
                  onClick={() => setNumbersWasher({ id: washer.id, name: washer.name })}
                >
                  <Banknote className="w-4 h-4 mr-1" />
                  Numéros de retrait
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Car className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucun laveur vérifié</p>
        </div>
      )}

      {/* Trusted withdrawal numbers management (admin-only) */}
      {numbersWasher && (
        <AdminWithdrawalNumbers
          washerId={numbersWasher.id}
          washerName={numbersWasher.name}
          onClose={() => setNumbersWasher(null)}
        />
      )}
    </div>
  );
}

// Trusted withdrawal numbers management — ADMIN ONLY.
// The washer adds up to 3 numbers at setup; afterwards only the admin can
// add/remove (following a washer request received as a notification).
function AdminWithdrawalNumbers({ washerId, washerName, onClose }: {
  washerId: string;
  washerName: string;
  onClose: () => void;
}) {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNumber, setNewNumber] = useState('');
  const [newOperator, setNewOperator] = useState('Mixx by Yas');
  const [isSaving, setIsSaving] = useState(false);

  const fetchNumbers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/washers/withdrawal-numbers?washerId=${washerId}`);
      const data = await parseJsonResponse<any>(res);
      if (data?.success) setNumbers(data.numbers ?? []);
    } catch (error) {
      console.error('Fetch withdrawal numbers error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [washerId]);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  const handleAdd = async () => {
    if (!/^\d{8}$/.test(newNumber)) {
      toast.error('Numéro invalide — 8 chiffres requis (ex: 90123456)');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/washers/withdrawal-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ washerId, phoneNumber: newNumber, operator: newOperator }),
      });
      const data = await parseJsonResponse<any>(res);
      if (data?.success) {
        toast.success('Numéro ajouté — le laveur a été notifié');
        setNewNumber('');
        fetchNumbers();
      } else {
        toast.error(data?.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: string, phone: string) => {
    try {
      const res = await fetch('/api/admin/washers/withdrawal-numbers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await parseJsonResponse<any>(res);
      if (data?.success) {
        toast.success(`+228 ${phone} retiré — le laveur a été notifié`);
        fetchNumbers();
      } else {
        toast.error(data?.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-brand-ink" />
            Numéros de retrait — {washerName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-brand-ink" />
            </div>
          ) : numbers.length === 0 ? (
            <p className="text-sm text-soft bg-app rounded-lg p-3 text-center">
              Aucun numéro confirmé pour ce laveur.
            </p>
          ) : (
            <div className="space-y-2">
              {numbers.map((n) => (
                <div key={n.id} className="flex items-center justify-between bg-app rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-sm text-ink">+228 {n.phoneNumber}</p>
                    <p className="text-xs text-soft">{n.operator ?? '—'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemove(n.id, n.phoneNumber)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {numbers.length < 3 && (
            <div className="space-y-2 border-t border-line pt-3">
              <label className="text-sm font-medium text-soft">Ajouter un numéro</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-soft">+228</span>
                  <Input
                    type="tel"
                    placeholder="90 12 34 56"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="pl-14 h-10"
                  />
                </div>
                <Button onClick={handleAdd} disabled={isSaving} className="bg-brand-ink hover:bg-brand-ink-strong">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Mixx by Yas', 'Flooz'].map((op) => (
                  <button
                    key={op}
                    onClick={() => setNewOperator(op)}
                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      newOperator === op ? 'border-brand-ink bg-brand-wash text-ink' : 'border-gray-200 text-soft'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-soft">
            Le laveur ne peut pas modifier ces numéros lui-même — il envoie une demande et vous seul agissez ici.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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

  const fetchServices = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/services');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Fetch services error:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Auto-sync : services toujours à jour (prix modifiés ailleurs, etc.)
  useAutoRefresh(fetchServices, 45000);

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
      
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
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
      
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        toast.success(service.isActive ? 'Service désactivé' : 'Service activé');
        fetchServices();
      } else {
        toast.error(data.error || 'Erreur lors de la modification');
      }
    } catch (error) {
      toast.error('Erreur lors de la modification');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-ink">Services</h2>
        <Button size="sm" className="bg-brand-ink hover:bg-brand-ink-strong">
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4 space-y-2">
                {/* Ligne 1 : nom + prix (le prix ne se coupe jamais) */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-ink leading-snug min-w-0">{service.name}</h3>
                  <p className="font-bold text-ink whitespace-nowrap tabular-nums">{service.price.toLocaleString('fr-FR')} F</p>
                </div>
                {/* Ligne 2 : infos courtes */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full border border-line px-2 py-0.5 text-soft">{service.category}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-soft">{service.duration} min</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${service.isActive ? 'bg-success/10 text-success' : 'bg-app text-soft'}`}>
                    {service.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                {service.description && (
                  <p className="text-xs text-soft leading-relaxed line-clamp-3">{service.description}</p>
                )}
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 border-line text-ink"
                    onClick={() => handleEditService(service)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Modifier
                  </Button>
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
              className="bg-brand-ink hover:bg-brand-ink-strong"
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
      <h2 className="font-semibold text-lg text-ink">Finances</h2>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <p className="text-xs text-soft">Revenus totaux</p>
            <HideableBalanceLight
              balance={stats?.totalRevenue || 0}
              currency="XOF"
              size="lg"
              storageKey="hide-admin-total-revenue"
              balanceClassName="text-ink"
            />
          </CardContent>
        </Card>
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4">
            <p className="text-xs text-soft">Ce mois</p>
            <HideableBalanceLight
              balance={stats?.monthRevenue || 0}
              currency="XOF"
              size="lg"
              storageKey="hide-admin-month-revenue"
              balanceClassName="text-soft"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border border-line shadow-none py-0 gap-0">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-soft">Commissions (15%)</p>
              <HideableBalanceLight
                balance={((stats?.totalRevenue || 0) * 0.15)}
                currency="XOF"
                size="lg"
                storageKey="hide-admin-commissions"
                balanceClassName="text-ink"
              />
            </div>
            <TrendingUp className="w-8 h-8 text-brand-ink" />
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
      id: 'stations',
      icon: Building2,
      label: 'Stations de Lavage',
      description: 'Liste et gestion des stations partenaires (distinctes des laveurs indépendants)',
      color: '#00897B',
    },
    {
      id: 'transactions',
      icon: Receipt,
      label: 'Historique des transactions',
      description: 'Tous les mouvements d\'argent (recharges, paiements, retraits, commissions)',
      color: '#2196F3',
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
      id: 'companies',
      icon: Building2,
      label: 'Entreprises',
      description: 'Flottes au forfait mensuel : contrats, véhicules, factures',
      color: '#0F1B2D',
    },
    {
      id: 'promotions',
      icon: Percent,
      label: 'Promotions',
      description: 'Gérer les codes promo et offres',
      color: '#FF5722',
    },
    {
      id: 'support',
      icon: Headphones,
      label: 'Support Clients',
      description: "Demandes remontées par l'assistant IA Soco — recontacter les utilisateurs",
      color: '#F44336',
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
      id: 'payment-system',
      icon: CreditCard,
      label: 'Système de Paiement',
      description: "Choisir le système affiché aux clients (Mixx by Yas ou PayDunya)",
      color: '#E65100',
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
      <h2 className="font-semibold text-lg text-ink">Plus d&apos;options</h2>

      <div className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="w-full flex items-center gap-3 p-3.5 bg-white rounded-xl border border-line hover:bg-app transition-colors active:scale-[0.99] text-left"
          >
            {/* Icônes neutres : une seule couleur pour un rendu sobre */}
            <div className="w-10 h-10 rounded-lg bg-app flex items-center justify-center flex-shrink-0">
              <item.icon className="w-5 h-5 text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink">{item.label}</span>
                {item.badge && (
                  <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center bg-brand-ink text-white text-[11px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-soft leading-snug mt-0.5">{item.description}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-soft -rotate-90 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 h-12 bg-white text-red-600 rounded-xl border border-line hover:bg-red-50 transition-colors mt-6"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Déconnexion</span>
      </button>
    </div>
  );
}

// Admin Operators Section
// ---------------------------------------------------------------------------
// Système de Paiement — l'admin choisit le système affiché aux clients
// (Mixx by Yas via USSD, ou PayDunya via page de checkout en ligne)
// ---------------------------------------------------------------------------
function AdminPaymentSystem() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [provider, setProvider] = useState<'MIXX_USSD' | 'PAYDUNYA'>('MIXX_USSD');
  const [paydunyaConfigured, setPaydunyaConfigured] = useState(false);
  const [form, setForm] = useState({
    mode: 'test',
    storeName: 'Socline',
    masterKey: '',
    privateKey: '',
    token: '',
  });
  const [hasKeys, setHasKeys] = useState({ masterKey: false, privateKey: false, token: false });

  const fetchConfig = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/payment-config');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        setProvider(data.provider);
        setPaydunyaConfigured(data.paydunyaConfigured);
        setForm({
          mode: data.paydunya.mode,
          storeName: data.paydunya.storeName || 'Socline',
          masterKey: data.paydunya.masterKey || '',
          privateKey: data.paydunya.privateKey || '',
          token: data.paydunya.token || '',
        });
        setHasKeys({
          masterKey: Boolean(data.paydunya.hasMasterKey),
          privateKey: Boolean(data.paydunya.hasPrivateKey),
          token: Boolean(data.paydunya.hasToken),
        });
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          paydunya: {
            mode: form.mode,
            storeName: form.storeName,
            masterKey: form.masterKey,
            privateKey: form.privateKey,
            token: form.token,
          },
        }),
      });
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        toast.success('Configuration de paiement enregistrée ✅');
        await fetchConfig(true);
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-brand-ink" />
      </div>
    );
  }

  const systems = [
    {
      id: 'MIXX_USSD' as const,
      name: 'Mixx by Yas (USSD)',
      description: "Le client compose le code USSD prérempli depuis son téléphone. Validation manuelle par l'admin.",
      icon: Phone,
      color: '#00BCD4',
      ready: true,
    },
    {
      id: 'PAYDUNYA' as const,
      name: 'PayDunya',
      description: 'Le client paie en ligne sur la page PayDunya (T-Money, Moov Money, Wave…). Validation automatique du solde.',
      icon: CreditCard,
      color: '#E65100',
      ready: paydunyaConfigured,
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      <p className="text-sm text-soft">
        Choisissez le système de paiement affiché aux clients pour recharger leur portefeuille.
      </p>

      {/* Sélecteur du système actif */}
      <div className="space-y-3">
        {systems.map((sys) => {
          const isActive = provider === sys.id;
          return (
            <button
              key={sys.id}
              onClick={() => setProvider(sys.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-brand-ink bg-brand-wash'
                  : 'border-line bg-white hover:border-line'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-app"
                >
                  <sys.icon className="w-5 h-5 text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink">{sys.name}</span>
                    {isActive ? (
                      <Badge className="bg-success/10 text-success border-success/30">Actif</Badge>
                    ) : null}
                    {!sys.ready ? (
                      <Badge className="bg-red-50 text-red-700 border-red-200">Non configuré</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-soft mt-1">{sys.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    isActive ? 'border-brand-ink bg-brand-ink' : 'border-line'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Configuration PayDunya (affichée si PayDunya sélectionné) */}
      {provider === 'PAYDUNYA' && (
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-ink flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-ink" />
                Configuration PayDunya
              </h3>
              <Badge
                className={
                  paydunyaConfigured
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {paydunyaConfigured ? 'Clés enregistrées' : 'Clés manquantes'}
              </Badge>
            </div>

            <p className="text-xs text-soft">
              Récupérez ces informations sur <span className="font-medium">paydunya.com</span> → Compte marchand → API / Intégration.
              Les clés enregistrées sont masquées ; ne renseignez un champ que pour le changer.
            </p>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm(prev => ({ ...prev, mode: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir le mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test (sandbox)</SelectItem>
                  <SelectItem value="live">Production (live)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-soft">
                En mode test, les paiements passent sur la page sandbox PayDunya — aucun argent réel.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nom de la boutique</Label>
              <Input
                value={form.storeName}
                onChange={(e) => setForm(prev => ({ ...prev, storeName: e.target.value }))}
                placeholder="Socline"
              />
              <p className="text-xs text-soft">Nom affiché au client sur la page de paiement.</p>
            </div>

            <div className="space-y-2">
              <Label>Clé maître (Master Key)</Label>
              <Input
                value={form.masterKey}
                onChange={(e) => setForm(prev => ({ ...prev, masterKey: e.target.value }))}
                placeholder={hasKeys.masterKey ? '•••••••• (enregistrée — laisser tel quel pour conserver)' : 'ex. wk_Txxx-xxxx-xxxx'}
              />
            </div>

            <div className="space-y-2">
              <Label>Clé privée (Private Key)</Label>
              <Input
                value={form.privateKey}
                onChange={(e) => setForm(prev => ({ ...prev, privateKey: e.target.value }))}
                placeholder={hasKeys.privateKey ? '•••••••• (enregistrée — laisser tel quel pour conserver)' : 'ex. test_private_xxxx / live_private_xxxx'}
              />
            </div>

            <div className="space-y-2">
              <Label>Token marchand</Label>
              <Input
                value={form.token}
                onChange={(e) => setForm(prev => ({ ...prev, token: e.target.value }))}
                placeholder={hasKeys.token ? '•••••••• (enregistré — laisser tel quel pour conserver)' : 'ex. +2xxx-xxxx-xxxx'}
              />
            </div>

            <div className="bg-brand-wash border border-line rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-brand-ink flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-brand-ink">
                    Dans votre tableau de bord PayDunya, collez cette URL dans le champ « Endpoint IPN » puis appuyez sur « Activer » :
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs text-brand-ink bg-white border border-line rounded px-2 py-1.5 break-all">
                      https://socline.oquitogo.com/api/payment/paydunya/webhook
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        const ipnUrl = 'https://socline.oquitogo.com/api/payment/paydunya/webhook';
                        try {
                          await navigator.clipboard.writeText(ipnUrl);
                          toast.success('URL IPN copiée');
                        } catch {
                          // Fallback WebView / contextes non sécurisés
                          try {
                            const ta = document.createElement('textarea');
                            ta.value = ipnUrl;
                            ta.style.position = 'fixed';
                            ta.style.opacity = '0';
                            document.body.appendChild(ta);
                            ta.select();
                            const ok = document.execCommand('copy');
                            document.body.removeChild(ta);
                            if (!ok) throw new Error('copy refusée');
                            toast.success('URL IPN copiée');
                          } catch {
                            toast.error('Copie impossible — copiez l\'URL manuellement');
                          }
                        }
                      }}
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-white bg-brand-ink-strong hover:bg-brand-ink-strong rounded px-2.5 py-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enregistrer */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-brand-ink hover:bg-brand-ink-strong h-12"
      >
        {isSaving ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <CheckCircle className="w-5 h-5 mr-2" />
        )}
        Enregistrer la configuration
      </Button>
    </div>
  );
}

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

  const fetchOperators = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const res = await fetch('/api/operators');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        setOperators(data.operators);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Auto-sync : opérateurs mobile money toujours à jour
  useAutoRefresh(fetchOperators, 45000);

  const handleSave = async () => {
    try {
      const url = editingOperator ? '/api/operators' : '/api/operators';
      const method = editingOperator ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOperator ? { ...form, id: editingOperator.id } : form),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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
        <p className="text-sm text-soft">Gérez les opérateurs de paiement mobile</p>
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
          className="bg-brand-ink hover:bg-brand-ink-strong"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : showForm ? (
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-soft">Nom technique</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mixx"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Nom affiché</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Mixx by Yas"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-soft">Pattern USSD</Label>
              <Input
                value={form.ussdPattern}
                onChange={(e) => setForm({ ...form, ussdPattern: e.target.value })}
                placeholder="*145*5*{montant}*1416831#  (marchand)  ou  *145*1*{montant}*{numero}*2#"
                className="mt-1"
              />
              <p className="text-[11px] text-soft mt-1">
                Le pattern doit contenir {'{montant}'} et se terminer par #. Format marchand Mixx : *145*5*{'{montant}'}*1416831#
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-soft">Numéro / code marchand destinataire</Label>
                <Input
                  value={form.recipientNumber}
                  onChange={(e) => setForm({ ...form, recipientNumber: e.target.value })}
                  placeholder="1416831"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Couleur</Label>
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
                <Label className="text-xs text-soft">Montant min (F)</Label>
                <Input
                  type="number"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Montant max (F)</Label>
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
              <Button onClick={handleSave} className="flex-1 bg-brand-ink hover:bg-brand-ink-strong">
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
            <Card key={operator.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-app"
                    >
                      <Phone className="w-5 h-5 text-ink" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{operator.displayName}</span>
                        {!operator.isActive && (
                          <Badge className="bg-gray-100 text-gray-600">Inactif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-soft">{operator.ussdPattern}</p>
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
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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
      <p className="text-sm text-soft">Configuration générale de l&apos;application</p>

      {/* App Info */}
      <Card className="border border-line shadow-none py-0 gap-0">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium text-ink">Informations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-soft">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-soft">Environnement</span>
              <Badge className="bg-success/10 text-success">Production</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border border-line shadow-none py-0 gap-0">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium text-ink">Actions rapides</h3>
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
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    code: '',
    displayType: 'TEXT',
    image: '',
    video: '',
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
      video: '',
      imagePosition: 'center',
      startDate: '',
      endDate: '',
      maxUses: '',
      maxUsesPerUser: '1',
      minOrderAmount: '',
      isActive: true,
    });
    setImagePreview(null);
    setVideoPreview(null);
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

  // Aucune limite de taille : les images ≤ 2 Mo sont gardées telles quelles,
  // les plus grandes sont automatiquement redimensionnées + ré-encodées
  // (1920px max, JPEG 88%) pour rester fluides — jamais de refus.
  const fileToPromoDataUrl = (file: File): Promise<string> => {
    if (file.size <= 2 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX_DIM = 1920;
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas indisponible');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image illisible'));
      };
      img.src = objectUrl;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez choisir un fichier image (PNG, JPG, WEBP…)');
      return;
    }
    try {
      const base64 = await fileToPromoDataUrl(file);
      setImagePreview(base64);
      setFormData((prev) => ({ ...prev, image: base64 }));
    } catch {
      toast.error('Impossible de lire cette image');
    }
  };

  // Vidéos : acceptées jusqu'à 15 Mo (≈ 20 Mo en base64, limite de payload
  // du reverse proxy VPS : 25 Mo) — au-delà, message clair.
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Veuillez choisir un fichier vidéo (MP4, WEBM…)');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('La vidéo ne doit pas dépasser 15 Mo. Compressez-la ou raccourcissez-la.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setVideoPreview(base64);
      setFormData((prev) => ({ ...prev, video: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.discountValue) {
      toast.error('Le nom et la valeur de la réduction sont obligatoires');
      return;
    }

    setIsSaving(true);
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

      const data = await parseJsonResponse<any>(res);
      if (!data) {
        toast.error('Aucune réponse du serveur — réessayez');
        return;
      }

      if (data.success) {
        toast.success(editingPromo ? 'Promotion mise à jour' : 'Promotion créée');
        resetForm();
        onRefresh();
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde — vérifiez votre connexion');
    } finally {
      setIsSaving(false);
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
      video: promo.video || '',
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
    if (promo.video) {
      setVideoPreview(promo.video);
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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        toast.success(promo.isActive ? 'Promotion désactivée' : 'Promotion activée');
        onRefresh();
      } else {
        toast.error(data.error || 'Erreur lors de la modification');
      }
    } catch (error) {
      toast.error('Erreur');
    }
  };

  // Suppression définitive d'une promotion (bouton corbeille) — après confirmation.
  // Avant : le bouton appelait une fonction inexistante, rien ne se passait.
  const handleDelete = async (id: string) => {
    const promo = promotions.find((p) => p.id === id);
    const label = promo?.code || promo?.name || 'cette promotion';
    if (!window.confirm(`Supprimer la promotion « ${label} » ? Cette action est définitive.`)) return;
    try {
      const res = await fetch(`/api/promotions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        toast.success('Promotion supprimée');
        onRefresh();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg text-ink">Promotions</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Button 
            size="sm" 
            className="bg-brand-ink hover:bg-brand-ink-strong"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-ink">
              {editingPromo ? 'Modifier la promotion' : 'Nouvelle promotion'}
            </h3>
            
            <div>
              <Label className="text-xs text-soft">Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Offre spéciale été"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-soft">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de l'offre"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-soft">Type de réduction</Label>
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
                <Label className="text-xs text-soft">Valeur *</Label>
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
              <Label className="text-xs text-soft">Code promo (optionnel)</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="WASHGO20"
                className="mt-1 uppercase"
              />
            </div>

            {/* Display Type Selection */}
            <div>
              <Label className="text-xs text-soft">Type d'affichage</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, displayType: 'TEXT', image: '', video: '' });
                    setImagePreview(null);
                    setVideoPreview(null);
                  }}
                  className={`flex-1 py-2 px-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all ${
                    formData.displayType === 'TEXT' 
                      ? 'border-brand-ink bg-brand-wash text-brand-ink' 
                      : 'border-line text-soft'
                  }`}
                >
                  Texte uniquement
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, displayType: 'IMAGE', video: '' })}
                  className={`flex-1 py-2 px-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                    formData.displayType === 'IMAGE' 
                      ? 'border-brand-ink bg-brand-wash text-brand-ink' 
                      : 'border-line text-soft'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Avec image
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, displayType: 'VIDEO', image: '' })}
                  className={`flex-1 py-2 px-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                    formData.displayType === 'VIDEO' 
                      ? 'border-brand-ink bg-brand-wash text-brand-ink' 
                      : 'border-line text-soft'
                  }`}
                >
                  <VideoIcon className="w-4 h-4" />
                  Avec vidéo
                </button>
              </div>
            </div>

            {/* Image upload - only show if displayType is IMAGE */}
            {formData.displayType === 'IMAGE' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-soft">Image de la promotion *</Label>
                  <div className="mt-1">
                    <label className={`flex flex-col items-center justify-center w-full ${imagePreview ? 'h-48' : 'h-32'} border-2 border-dashed border-line rounded-lg ${!imagePreview ? 'cursor-pointer hover:bg-app' : ''} transition-colors`}>
                      {imagePreview ? (
                        <ImagePositionEditor
                          imageSrc={imagePreview}
                          position={formData.imagePosition}
                          onPositionChange={(pos) => setFormData((prev) => ({ ...prev, imagePosition: pos }))}
                          onRemove={() => {
                            setImagePreview(null);
                            setFormData({ ...formData, image: '', imagePosition: 'center' });
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ImageIcon className="w-8 h-8 text-soft mb-2" />
                          <p className="text-xs text-soft">Cliquez pour ajouter une image</p>
                          <p className="text-xs text-soft">PNG, JPG, WEBP — toutes tailles acceptées</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Video upload - only show if displayType is VIDEO */}
            {formData.displayType === 'VIDEO' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-soft">Vidéo de la promotion *</Label>
                  <div className="mt-1">
                    <label className={`flex flex-col items-center justify-center w-full ${videoPreview ? 'h-56' : 'h-32'} border-2 border-dashed border-line rounded-lg ${!videoPreview ? 'cursor-pointer hover:bg-app' : ''} transition-colors`}>
                      {videoPreview ? (
                        <div className="relative w-full h-full">
                          <video
                            src={videoPreview}
                            controls
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVideoPreview(null);
                              setFormData({ ...formData, video: '' });
                            }}
                            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
                            aria-label="Retirer la vidéo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <VideoIcon className="w-8 h-8 text-soft mb-2" />
                          <p className="text-xs text-soft">Cliquez pour ajouter une vidéo</p>
                          <p className="text-xs text-soft">MP4, WEBM (max 15 Mo) — lue en boucle sans le son</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleVideoChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-soft">Date début *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Date fin *</Label>
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
              <Label className="text-xs text-soft">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-brand-ink hover:bg-brand-ink-strong"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isSaving ? 'Enregistrement…' : editingPromo ? 'Mettre à jour' : 'Créer'}
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
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : promotions.length > 0 ? (
        <div className="space-y-3">
          {promotions.map((promo) => (
            <Card key={promo.id} className={`border border-line shadow-none py-0 gap-0 ${!promo.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Image / video thumbnail */}
                  {promo.displayType === 'VIDEO' && promo.video ? (
                    <div className="relative w-full sm:w-20 h-32 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <video
                        src={promo.video}
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <Film className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : promo.image ? (
                    <div className="w-full sm:w-20 h-32 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      <img 
                        src={promo.image} 
                        alt={promo.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: promo.imagePosition || 'center' }}
                      />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-ink truncate">{promo.name}</h3>
                          <Badge className={
                            isPromoActive(promo) 
                              ? 'bg-success/10 text-success' 
                              : promo.isActive 
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                          }>
                            {isPromoActive(promo) ? 'Active' : promo.isActive ? 'À venir' : 'Inactive'}
                          </Badge>
                        </div>
                        {promo.description && (
                          <p className="text-xs text-soft mt-1 line-clamp-2">{promo.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-lg font-bold text-ink tabular-nums">
                            {promo.discountType === 'PERCENTAGE' 
                              ? `-${promo.discountValue}%` 
                              : `-${promo.discountValue.toLocaleString()}F`}
                          </span>
                          {promo.code && (
                            <span className="rounded-md border border-line bg-app px-2 py-0.5 font-mono text-xs text-ink">
                              {promo.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-soft mt-2">
                          {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                        </p>
                        <p className="text-xs text-soft mt-1">
                          Utilisé {promo.currentUses} fois
                        </p>
                      </div>
                      {/* Action buttons - horizontal on mobile, vertical on desktop */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-9 border-line text-ink" onClick={() => handleEdit(promo)}>
                          <Edit className="w-3.5 h-3.5 mr-1.5" /> Modifier
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 border-line text-ink" onClick={() => handleToggleActive(promo)}>
                          {promo.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 text-soft hover:text-red-600"
                          onClick={() => handleDelete(promo.id)}
                          aria-label={`Supprimer la promotion ${promo.code || promo.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
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
          <Tag className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucune promotion</p>
          <Button 
            className="mt-4 bg-brand-ink hover:bg-brand-ink-strong"
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
        <h2 className="font-semibold text-lg text-ink">Demandes de recharge</h2>
        <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Deposits */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : deposits.length > 0 ? (
        <div className="space-y-3">
          {deposits.map((deposit) => (
            <Card key={deposit.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-ink">{deposit.user?.name || 'Client'}</h3>
                      <Badge className="bg-amber-50 text-amber-800">En attente</Badge>
                    </div>
                    <p className="text-xs text-soft">{deposit.user?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ink tabular-nums">{deposit.amount.toLocaleString()} XOF</p>
                  </div>
                </div>
                
                <div className="bg-app rounded-lg p-3 space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-soft" />
                    <span className="text-sm text-ink">+228 {deposit.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-soft" />
                    <span className="text-sm text-ink">{deposit.paymentMethod}</span>
                  </div>
                  <div className="text-xs text-soft">
                    {new Date(deposit.createdAt).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  {deposit.provider === 'PAYDUNYA' ? (
                    // PayDunya : la validation vient du statut PayDunya,
                    // jamais d'une décision admin — on ne fait que re-vérifier.
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onAction(deposit.id, 'validate')}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Vérifier le statut PayDunya
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="flex-1 bg-brand-ink hover:bg-brand-ink-strong"
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
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Wallet className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucune demande de recharge en attente</p>
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
        <h2 className="font-semibold text-lg text-ink">Demandes de retrait</h2>
        <button onClick={onRefresh} disabled={isLoading} className="w-10 h-10 rounded-md border border-line bg-white flex items-center justify-center text-soft hover:bg-app" aria-label="Rafraîchir">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Withdrawals */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : withdrawals.length > 0 ? (
        <div className="space-y-3">
          {withdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-ink">{withdrawal.washer?.user?.name || 'Laveur'}</h3>
                      <Badge className="bg-amber-50 text-amber-800">En attente</Badge>
                    </div>
                    <p className="text-xs text-soft">{withdrawal.washer?.user?.phone || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-soft">{withdrawal.amount.toLocaleString()} XOF</p>
                  </div>
                </div>
                
                <div className="bg-app rounded-lg p-3 space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-soft" />
                    <span className="text-sm text-ink">+228 {withdrawal.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-soft" />
                    <span className="text-sm text-ink">{withdrawal.operator}</span>
                  </div>
                  <div className="text-xs text-soft">
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
                    className="flex-1 bg-brand-ink hover:bg-brand-ink-strong"
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
          <Banknote className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucune demande de retrait en attente</p>
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

  const fetchData = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const [plansRes, servicesRes] = await Promise.all([
        fetch('/api/subscription-plans'),
        fetch('/api/services')
      ]);
      
      const plansData = await parseJsonResponse<any>(plansRes);
      const servicesData = await parseJsonResponse<any>(servicesRes);
      if (!plansData || !servicesData) return;
      
      if (plansData.success) {
        setPlans(plansData.plans);
      }
      if (servicesData.success) {
        setServices(servicesData.services.filter((s: any) => s.isActive));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (!background) toast.error('Erreur lors du chargement');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  // Auto-sync : forfaits toujours à jour
  useAutoRefresh(fetchData, 45000);

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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      if (data.success) {
        toast.success(plan.isActive ? 'Forfait désactivé' : 'Forfait activé');
        fetchData();
      } else {
        toast.error(data.error || 'Erreur lors de la modification');
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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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
        <p className="text-sm text-soft">Gérez les forfaits d&apos;abonnement disponibles</p>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-brand-ink hover:bg-brand-ink-strong"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau forfait
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-ink">
              {editingPlan ? 'Modifier le forfait' : 'Nouveau forfait'}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-soft">Nom technique *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  placeholder="ESSENTIEL"
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Nom affiché *</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Abonnement Essentiel"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-soft">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du forfait"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-soft">Service associé *</Label>
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
                <Label className="text-xs text-soft">Prix mensuel (F) *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="15000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Prix trimestriel (F)</Label>
                <Input
                  type="number"
                  value={formData.quarterlyPrice}
                  onChange={(e) => setFormData({ ...formData, quarterlyPrice: e.target.value })}
                  placeholder="40000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Prix annuel (F)</Label>
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
                <Label className="text-xs text-soft">Nombre de lavages *</Label>
                <Input
                  type="number"
                  value={formData.washCount}
                  onChange={(e) => setFormData({ ...formData, washCount: e.target.value })}
                  placeholder="4"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Priorité</Label>
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
                <Label className="text-xs text-soft">Lavages bonus</Label>
                <Input
                  type="number"
                  value={formData.bonusWashes}
                  onChange={(e) => setFormData({ ...formData, bonusWashes: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-soft">Options gratuites</Label>
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
                <Label className="text-xs text-soft">Service express inclus</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.includesVip}
                  onCheckedChange={(v) => setFormData({ ...formData, includesVip: v })}
                />
                <Label className="text-xs text-soft">Accès VIP</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label className="text-xs text-soft">Actif</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1 bg-brand-ink hover:bg-brand-ink-strong" disabled={isSaving}>
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
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : plans.length > 0 ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`border border-line shadow-none py-0 gap-0 ${!plan.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-2">
                {/* Ligne 1 : nom + prix mensuel */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-ink leading-snug min-w-0">{plan.displayName}</h3>
                  <p className="font-bold text-ink whitespace-nowrap tabular-nums">
                    {plan.price.toLocaleString('fr-FR')} F<span className="text-xs font-normal text-soft"> /mois</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full border border-line px-2 py-0.5 text-soft">{plan.name}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${plan.isActive ? 'bg-success/10 text-success' : 'bg-app text-soft'}`}>
                    {plan.isActive ? 'Actif' : 'Inactif'}
                  </span>
                  {plan.includesExpress && <span className="rounded-full border border-line px-2 py-0.5 text-soft">Express</span>}
                  {plan.includesVip && <span className="rounded-full border border-line px-2 py-0.5 text-soft">VIP</span>}
                </div>
                {plan.description && <p className="text-xs text-soft leading-relaxed">{plan.description}</p>}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex gap-1"><dt className="text-soft">Service :</dt><dd className="text-ink truncate">{plan.service?.name || '—'}</dd></div>
                  <div className="flex gap-1"><dt className="text-soft">Lavages :</dt><dd className="text-ink">{plan.washCount}{plan.bonusWashes > 0 ? ` (+${plan.bonusWashes} bonus)` : ''}</dd></div>
                  <div className="flex gap-1"><dt className="text-soft">Priorité :</dt><dd className="text-ink">{getPriorityLabel(plan.priority)}</dd></div>
                  <div className="flex gap-1"><dt className="text-soft">Abonnés :</dt><dd className="text-ink">{plan.subscribersCount}</dd></div>
                  {plan.quarterlyPrice ? <div className="flex gap-1"><dt className="text-soft">Trimestre :</dt><dd className="text-ink">{plan.quarterlyPrice.toLocaleString('fr-FR')} F</dd></div> : null}
                  {plan.yearlyPrice ? <div className="flex gap-1"><dt className="text-soft">Année :</dt><dd className="text-ink">{plan.yearlyPrice.toLocaleString('fr-FR')} F</dd></div> : null}
                </dl>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-9 border-line text-ink" onClick={() => handleEdit(plan)}>
                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 border-line text-ink" onClick={() => handleToggleActive(plan)}>
                    {plan.isActive ? 'Désactiver' : 'Activer'}
                  </Button>
                  {plan.subscribersCount === 0 && (
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-soft hover:text-red-600" onClick={() => setDeleteConfirm(plan)} aria-label="Supprimer le forfait">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg">
          <Tag className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Aucun forfait configuré</p>
          <Button className="mt-4 bg-brand-ink hover:bg-brand-ink-strong" onClick={() => setShowForm(true)}>
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
            <p className="text-sm text-soft">
              Êtes-vous sûr de vouloir supprimer le forfait <strong>{deleteConfirm?.displayName}</strong> ?
            </p>
            <p className="text-xs text-red-600 mt-2">Cette action est irréversible.</p>
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

  const fetchData = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      // Fetch subscriptions
      const subRes = await fetch(`/api/admin/subscriptions?status=${statusFilter}`);
      const subData = await parseJsonResponse<any>(subRes);
      if (!subData) return;
      if (subData.success) {
        setSubscriptions(subData.subscriptions);
        setStats(subData.stats);
      }

      // Fetch pending usages
      const usageRes = await fetch('/api/admin/subscriptions/usages?status=PENDING');
      const usageData = await parseJsonResponse<any>(usageRes);
      if (!usageData) return;
      if (usageData.success) {
        setUsages(usageData.usages);
        setUsageStats(usageData.stats);
      }
    } catch (error) {
      console.error('Fetch subscriptions error:', error);
      if (!background) toast.error('Erreur lors du chargement');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [statusFilter]);

  // Auto-sync : abonnements et validations de séances toujours à jour
  useAutoRefresh(fetchData, 30000);

  const handleValidateUsage = async (usageId: string, action: 'VALIDATE' | 'CANCEL') => {
    try {
      const res = await fetch('/api/admin/subscriptions/usages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usageId, action }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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
      PENDING: 'bg-amber-50 text-amber-800',
      VALIDATED: 'bg-success/10 text-success',
      CANCELLED: 'bg-red-50 text-red-700',
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
      <div className="flex bg-app rounded-lg p-1">
        <button
          onClick={() => setViewMode('validations')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            viewMode === 'validations'
              ? 'bg-white text-brand-ink shadow-sm'
              : 'text-soft'
          }`}
        >
          Validations ({usageStats.pending})
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            viewMode === 'list'
              ? 'bg-white text-brand-ink shadow-sm'
              : 'text-soft'
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
              <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
            </div>
          ) : usages.length > 0 ? (
            <div className="space-y-3">
              {usages.map((usage) => (
                <Card key={usage.id} className="border border-line shadow-none py-0 gap-0">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-ink">
                          {usage.subscription.user.name || 'Client'}
                        </p>
                        <p className="text-sm text-soft">
                          +228 {usage.subscription.user.phone}
                        </p>
                      </div>
                      {getStatusBadge(usage.status)}
                    </div>
                    
                    <div className="bg-app rounded-lg p-3 space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-soft">Plan</span>
                        <span className="text-sm font-medium">{usage.subscription.plan.displayName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-soft">Service</span>
                        <span className="text-sm font-medium">{usage.serviceName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-soft">Date</span>
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
                          <span className="text-sm text-soft">Laveur</span>
                          <span className="text-sm font-medium">{usage.order.washer.user.name}</span>
                        </div>
                      )}
                    </div>

                    {usage.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-brand-ink hover:bg-brand-ink-strong"
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
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
              <p className="text-soft">Aucune séance en attente de validation</p>
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
            <Card className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-success">{stats.totalActive}</p>
                <p className="text-xs text-soft">Abonnements actifs</p>
              </CardContent>
            </Card>
            <Card className="border border-line shadow-none py-0 gap-0">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-ink">{stats.pendingValidations}</p>
                <p className="text-xs text-soft">En attente</p>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {subscriptions.map((sub) => (
                <Card key={sub.id} className="border border-line shadow-none py-0 gap-0">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-ink">
                          {sub.user.name || 'Client'}
                        </p>
                        <p className="text-sm text-soft">+228 {sub.user.phone}</p>
                      </div>
                      <Badge className={sub.isActive && !sub.isExpired ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-800'}>
                        {sub.plan.displayName}
                      </Badge>
                    </div>
                    
                    <div className="bg-app rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-soft">Séances</span>
                        <span className="text-sm font-medium">
                          {sub.remainingWashes} / {sub.totalWashes} restantes
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-soft">Expire le</span>
                        <span className="text-sm font-medium">
                          {new Date(sub.endDate).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-brand-ink h-2 rounded-full"
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
              <Tag className="w-12 h-12 text-soft mx-auto mb-3" />
              <p className="text-soft">Aucun abonnement trouvé</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Transactions — HISTORIQUE GLOBAL des mouvements d'argent de la
// plateforme : rechargements, paiements de commandes, retraits laveurs,
// remboursements, bonus et règlements de commission espèces.
// ---------------------------------------------------------------------------
interface AdminTransactionRow {
  id: string;
  type: string;
  amount: number;
  status: string;
  description?: string | null;
  orderId?: string | null;
  createdAt: string;
  wallet?: {
    user?: { name?: string | null; phone?: string | null; role?: string } | null;
  } | null;
}

function AdminTransactions() {
  const [transactions, setTransactions] = useState<AdminTransactionRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      const data = await parseJsonResponse<any>(res);
      if (data?.success) {
        setTransactions(data.transactions ?? []);
        setSummary(data.summary ?? null);
      }
    } catch (error) {
      console.error('Fetch transactions error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh: les transactions changent quand les clients/laveurs agissent
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  const TYPE_META: Record<string, { label: string; color: string; sign: '+' | '-' | '' }> = {
    DEPOSIT: { label: 'Rechargement', color: 'bg-app text-ink', sign: '+' },
    PAYMENT: { label: 'Paiement', color: 'bg-app text-ink', sign: '-' },
    WITHDRAWAL: { label: 'Retrait', color: 'bg-app text-ink', sign: '-' },
    REFUND: { label: 'Remboursement', color: 'bg-app text-ink', sign: '+' },
    BONUS: { label: 'Bonus', color: 'bg-app text-ink', sign: '+' },
    COMMISSION_SETTLEMENT: { label: 'Commission espèces', color: 'bg-app text-ink', sign: '' },
    ACCOUNT_CLOSURE: { label: 'Compte supprimé', color: 'bg-app text-ink', sign: '' },
  };

  const STATUS_META: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'En attente', color: 'bg-amber-50 text-amber-800' },
    COMPLETED: { label: 'Terminé', color: 'bg-success/10 text-success' },
    FAILED: { label: 'Échoué', color: 'bg-red-50 text-red-700' },
    CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-800' },
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? transactions.filter((t) =>
        (t.wallet?.user?.name ?? '').toLowerCase().includes(q) ||
        (t.wallet?.user?.phone ?? '').includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    : transactions;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border border-line rounded-lg p-3">
            <p className="text-xs text-soft">Rechargements</p>
            <p className="text-lg font-bold text-ink tabular-nums">{(summary.deposits?.total ?? 0).toLocaleString()} XOF</p>
            <p className="text-[11px] text-soft">{summary.deposits?.count ?? 0} transaction(s)</p>
          </div>
          <div className="bg-white border border-line rounded-lg p-3">
            <p className="text-xs text-soft">Retraits payés</p>
            <p className="text-lg font-bold text-ink tabular-nums">{(summary.withdrawals?.total ?? 0).toLocaleString()} XOF</p>
            <p className="text-[11px] text-soft">{summary.withdrawals?.count ?? 0} transaction(s)</p>
          </div>
          <div className="bg-white border border-line rounded-lg p-3">
            <p className="text-xs text-soft">Paiements commandes</p>
            <p className="text-lg font-bold text-ink tabular-nums">{(summary.payments?.total ?? 0).toLocaleString()} XOF</p>
            <p className="text-[11px] text-soft">{summary.payments?.count ?? 0} transaction(s)</p>
          </div>
          <div className="bg-white border border-line rounded-lg p-3">
            <p className="text-xs text-soft">Commissions récupérées</p>
            <p className="text-lg font-bold text-ink tabular-nums">{(summary.commissionSettlements?.total ?? 0).toLocaleString()} XOF</p>
            <p className="text-[11px] text-soft">{summary.commissionSettlements?.count ?? 0} règlement(s)</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher (nom, téléphone, description)…"
            className="pl-9 h-10 bg-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-10 bg-white">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous types</SelectItem>
            <SelectItem value="DEPOSIT">Rechargements</SelectItem>
            <SelectItem value="PAYMENT">Paiements</SelectItem>
            <SelectItem value="WITHDRAWAL">Retraits</SelectItem>
            <SelectItem value="COMMISSION_SETTLEMENT">Commissions</SelectItem>
            <SelectItem value="REFUND">Remboursements</SelectItem>
            <SelectItem value="BONUS">Bonus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center">
          <Receipt className="w-12 h-12 text-soft mx-auto mb-3" />
          <p className="text-soft">Aucune transaction trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const typeMeta = TYPE_META[t.type] ?? { label: t.type, color: 'bg-gray-100 text-gray-800', sign: '' as const };
            const statusMeta = STATUS_META[t.status] ?? { label: t.status, color: 'bg-gray-100 text-gray-800' };
            return (
              <Card key={t.id} className="border border-line shadow-none py-0 gap-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-ink mt-1 truncate">
                        {t.wallet?.user?.name || 'Utilisateur'}
                        <span className="text-xs font-normal text-soft">
                          {' '}• {t.wallet?.user?.phone || '—'}{t.wallet?.user?.role ? ` • ${t.wallet.user.role}` : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-soft truncate">
                        {t.description || '—'} • {new Date(t.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm tabular-nums ${typeMeta.sign === '+' ? 'text-success' : 'text-ink'}`}>
                        {typeMeta.sign === '-' ? '−' : typeMeta.sign === '+' ? '+' : ''}
                        {t.amount.toLocaleString()} XOF
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Admin Stations — Gestion des stations de lavage (distinctes des laveurs
// indépendants) : liste complète, activation, vérification du propriétaire.
function AdminStations({ stations, isLoading, onRefresh, onAction }: {
  stations: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onAction: (stationId: string, action: 'toggle-active' | 'verify-owner' | 'reject-owner') => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = stations.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.owner?.phone || '').includes(q) ||
      (s.owner?.name || '').toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-soft">
          {stations.length} station{stations.length > 1 ? 's' : ''} partenaire{stations.length > 1 ? 's' : ''}
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Actualiser
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft" />
        <Input
          placeholder="Rechercher (nom, adresse, propriétaire, téléphone...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border border-line shadow-none py-0 gap-0">
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 text-soft mx-auto mb-3" />
            <p className="text-soft">
              {stations.length === 0
                ? 'Aucune station enregistrée. Les propriétaires de station s\'inscrivent via « Devenir partenaire laveur » → « Station de Lavage ».'
                : 'Aucune station ne correspond à votre recherche.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((station) => {
            const ownerVerified = station.owner?.washer?.isVerified ?? false;
            const services = station.services || [];
            return (
              <Card key={station.id} className={`border border-line shadow-none py-0 gap-0 ${!station.isActive ? 'opacity-70' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  {/* En-tête : nom + statut */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-app flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{station.name}</p>
                        <p className="text-xs text-soft flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{station.address}</span>
                        </p>
                      </div>
                    </div>
                    <Badge className={station.isActive
                      ? 'bg-success/10 text-success hover:bg-success/10'
                      : 'bg-danger/5 text-danger hover:bg-danger/5'}
                    >
                      {station.isActive ? 'Active' : 'Désactivée'}
                    </Badge>
                  </div>

                  {/* Description */}
                  {station.description && (
                    <p className="text-xs text-soft line-clamp-2">{station.description}</p>
                  )}

                  {/* Propriétaire */}
                  <div className="bg-app rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-ink">
                      Propriétaire : {station.owner?.name || 'Aucun (station sans compte rattaché)'}
                    </p>
                    {station.owner?.phone && (
                      <p className="text-xs text-soft flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        +228 {station.owner.phone}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {station.owner ? (
                        <>
                          <Badge className={
                            ownerVerified
                              ? 'bg-success/10 text-success hover:bg-success/10'
                              : 'bg-brand-wash text-brand-ink hover:bg-brand-wash'
                          }>
                            {ownerVerified ? 'Compte vérifié' : 'En attente de validation'}
                          </Badge>
                          {!station.owner.isActive && (
                            <Badge className="bg-danger/5 text-danger hover:bg-danger/5">
                              Compte désactivé
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge className="bg-app text-soft hover:bg-app">
                          Sans propriétaire
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Services + stats */}
                  <div className="flex items-center gap-4 text-xs text-soft">
                    <span>{station._count?.services ?? services.length} service(s)</span>
                    <span>{station._count?.washers ?? 0} laveur(s)</span>
                    <span>{station._count?.orders ?? 0} commande(s)</span>
                  </div>
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {services.slice(0, 4).map((svc: any) => (
                        <span key={svc.id} className="text-[11px] bg-brand-wash text-brand-ink border border-line rounded px-1.5 py-0.5">
                          {svc.name} · {svc.price.toLocaleString()} F
                        </span>
                      ))}
                      {services.length > 4 && (
                        <span className="text-[11px] text-soft px-1 py-0.5">
                          +{services.length - 4} autre(s)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {!station.owner ? (
                      <Button
                        size="sm"
                        variant={station.isActive ? 'outline' : 'default'}
                        onClick={() => onAction(station.id, 'toggle-active')}
                        className={`flex-1 h-9 text-xs ${station.isActive
                          ? 'text-danger hover:bg-danger/5'
                          : 'bg-brand-ink hover:bg-brand-ink-strong text-white'}`}
                      >
                        {station.isActive ? 'Désactiver la station' : 'Activer la station'}
                      </Button>
                    ) : !ownerVerified ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onAction(station.id, 'verify-owner')}
                          className="flex-1 bg-brand-ink hover:bg-brand-ink-strong text-white h-9 text-xs"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Vérifier le propriétaire
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAction(station.id, 'reject-owner')}
                          className="flex-1 h-9 text-xs text-danger hover:bg-danger/5"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeter
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant={station.isActive ? 'outline' : 'default'}
                        onClick={() => onAction(station.id, 'toggle-active')}
                        className={`flex-1 h-9 text-xs ${station.isActive
                          ? 'text-danger hover:bg-danger/5'
                          : 'bg-brand-ink hover:bg-brand-ink-strong text-white'}`}
                      >
                        {station.isActive ? 'Désactiver la station' : 'Activer la station'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
