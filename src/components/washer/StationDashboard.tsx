'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CoverageBadge } from '@/components/shared/ServiceCoverage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Plus,
  Edit,
  Trash2,
  Tag,
  DollarSign,
  Clock,
  MapPin,
  Phone,
  Star,
  Building2,
  ShoppingBag,
  Settings,
  LogOut,
  RefreshCw,
  Loader2,
  AlertCircle,
  Package,
  Image as ImageIcon,
  Calendar,
  User as UserIcon,
  ImagePlus,
  X,
  LocateFixed,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseJsonResponse } from '@/lib/json-helper';
import { fileToCompressedDataUrl, buildStationDirectionsUrl } from '@/lib/image-utils';
import type { User, Washer, Station, Service, Order, OrderStatus } from '@/types';

// ---------- Types ----------
interface StationDashboardProps {
  washer: Washer;
  user?: User | null;
  onLogout?: () => void;
}

interface StationFormValues {
  name: string;
  address: string;
  phone: string;
  description: string;
  email: string;
  images: string[];      // Photos de la station (devanture…) — Data URLs
  latitude: string;      // Position GPS (chaînes de formulaire, vides si non définie)
  longitude: string;
}

// Parse le champ JSON `images` d'une station en tableau sûr
function parseStationImages(images: unknown): string[] {
  try {
    const raw = typeof images === 'string' ? JSON.parse(images) : images;
    return Array.isArray(raw) ? raw.filter((i): i is string => typeof i === 'string' && i.length > 0) : [];
  } catch {
    return [];
  }
}

export { parseStationImages };

interface ServiceFormValues {
  name: string;
  description: string;
  price: string;
  duration: string;
  category: string;
  image: string;
  coverage: string;
}

const SERVICE_CATEGORIES = [
  { value: 'basic', label: 'Basique' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'express', label: 'Express' },
  { value: 'complete', label: 'Lavage complet' },
];

// What the wash covers — shown to clients as the extérieur vs complet difference
const SERVICE_COVERAGES = [
  { value: 'EXTERIOR', label: 'Extérieur seul (carrosserie)' },
  { value: 'FULL', label: 'Complet (extérieur + intérieur)' },
];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  EN_ROUTE: 'En route',
  ARRIVED: 'Arrivé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  EN_ROUTE: 'bg-yellow-100 text-yellow-800',
  ARRIVED: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

// ---------- Main component ----------
export function StationDashboard({ washer, user, onLogout }: StationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'station' | 'services' | 'orders' | 'profile'>('station');

  // Station state
  const [station, setStation] = useState<Station | null>(washer.station || null);
  const [isLoadingStation, setIsLoadingStation] = useState(false);
  const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
  const [isSavingStation, setIsSavingStation] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isGettingPosition, setIsGettingPosition] = useState(false);

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Form state for station
  const [stationForm, setStationForm] = useState<StationFormValues>({
    name: '',
    address: '',
    phone: '',
    description: '',
    email: '',
    images: [],
    latitude: '',
    longitude: '',
  });

  // Form state for service
  const emptyServiceForm: ServiceFormValues = {
    name: '',
    description: '',
    price: '',
    duration: '',
    category: 'standard',
    image: '',
    coverage: 'FULL',
  };
  const [serviceForm, setServiceForm] = useState<ServiceFormValues>(emptyServiceForm);

  // ---------- Data fetching ----------
  const fetchStation = useCallback(async () => {
    if (!washer.stationId) return;
    setIsLoadingStation(true);
    try {
      const res = await fetch(`/api/stations/${washer.stationId}`);
      const data = await parseJsonResponse<{ success: boolean; station: Station }>(res);
      if (data && data.success && data.station) {
        setStation(data.station);
      }
    } catch (error) {
      console.error('Fetch station error:', error);
      toast.error('Erreur lors du chargement de la station');
    } finally {
      setIsLoadingStation(false);
    }
  }, [washer.stationId]);

  const fetchServices = useCallback(async () => {
    if (!washer.stationId) return;
    setIsLoadingServices(true);
    try {
      const res = await fetch(`/api/stations/${washer.stationId}/services`);
      const data = await parseJsonResponse<{ success: boolean; services: Service[] }>(res);
      if (data && data.success && Array.isArray(data.services)) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Fetch services error:', error);
      toast.error('Erreur lors du chargement des services');
    } finally {
      setIsLoadingServices(false);
    }
  }, [washer.stationId]);

  const fetchOrders = useCallback(async () => {
    if (!washer.stationId) return;
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?stationId=${washer.stationId}`);
      const data = await parseJsonResponse<{ success: boolean; orders: Order[] }>(res);
      if (data && data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setIsLoadingOrders(false);
    }
  }, [washer.stationId]);

  // Initial load
  useEffect(() => {
    fetchStation();
    fetchServices();
    fetchOrders();
  }, [fetchStation, fetchServices, fetchOrders]);

  // ---------- Station editing ----------
  const openStationDialog = () => {
    setStationForm({
      name: station?.name || '',
      address: station?.address || '',
      phone: station?.phone || '',
      description: station?.description || '',
      email: station?.email || '',
      images: parseStationImages(station?.images),
      latitude: station?.latitude != null ? String(station.latitude) : '',
      longitude: station?.longitude != null ? String(station.longitude) : '',
    });
    setIsStationDialogOpen(true);
  };

  // Ajout de photos (devanture, enseigne…) — compression automatique
  const handleAddStationImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (files.length === 0) return;
    const remaining = 5 - stationForm.images.length;
    if (remaining <= 0) {
      toast.error('Maximum 5 photos par station');
      return;
    }
    const selected = files.slice(0, remaining);
    setIsUploadingImages(true);
    try {
      const added: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith('image/')) {
          toast.error(`« ${file.name} » n'est pas une image`);
          continue;
        }
        added.push(await fileToCompressedDataUrl(file, 1280, 0.85));
      }
      if (added.length > 0) {
        setStationForm((prev) => ({ ...prev, images: [...prev.images, ...added] }));
        toast.success(`${added.length} photo${added.length > 1 ? 's' : ''} ajoutée${added.length > 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Impossible de lire cette image');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveStationImage = (index: number) => {
    setStationForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  // Position GPS automatique depuis l'appareil
  const handleUseCurrentPosition = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil");
      return;
    }
    setIsGettingPosition(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStationForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setIsGettingPosition(false);
        toast.success('Position GPS enregistrée');
      },
      () => {
        setIsGettingPosition(false);
        toast.error("Impossible d'obtenir votre position (autorisez la géolocalisation)");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleSaveStation = async () => {
    if (!washer.stationId) {
      toast.error('Aucune station associée à ce compte');
      return;
    }
    if (!stationForm.name.trim()) {
      toast.error('Le nom de la station est requis');
      return;
    }
    if (!stationForm.address.trim()) {
      toast.error('L\'adresse de la station est requise');
      return;
    }

    setIsSavingStation(true);
    try {
      const res = await fetch(`/api/stations/${washer.stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: stationForm.name.trim(),
          address: stationForm.address.trim(),
          phone: stationForm.phone.trim() || null,
          email: stationForm.email.trim() || null,
          description: stationForm.description.trim() || null,
          images: JSON.stringify(stationForm.images),
          latitude: stationForm.latitude ? parseFloat(stationForm.latitude) : null,
          longitude: stationForm.longitude ? parseFloat(stationForm.longitude) : null,
        }),
      });
      const data = await parseJsonResponse<{ success: boolean; station: Station; error?: string }>(res);
      if (!data) {
        toast.error('Erreur lors de la mise à jour de la station');
        return;
      }
      if (!data.success) {
        toast.error(data.error || 'Erreur lors de la mise à jour de la station');
        return;
      }
      setStation(data.station);
      setIsStationDialogOpen(false);
      toast.success('Station mise à jour avec succès');
    } catch (error) {
      console.error('Save station error:', error);
      toast.error('Erreur lors de la mise à jour de la station');
    } finally {
      setIsSavingStation(false);
    }
  };

  // ---------- Service add/edit/delete ----------
  const openAddServiceDialog = () => {
    setEditingService(null);
    setServiceForm(emptyServiceForm);
    setIsServiceDialogOpen(true);
  };

  const openEditServiceDialog = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name || '',
      description: service.description || '',
      price: service.price !== undefined ? String(service.price) : '',
      duration: service.duration !== undefined ? String(service.duration) : '',
      category: service.category || 'standard',
      image: service.image || '',
      coverage: service.coverage === 'EXTERIOR' ? 'EXTERIOR' : 'FULL',
    });
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!washer.stationId) {
      toast.error('Aucune station associée à ce compte');
      return;
    }
    if (!serviceForm.name.trim()) {
      toast.error('Le nom du service est requis');
      return;
    }
    const numericPrice = parseFloat(serviceForm.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      toast.error('Prix invalide');
      return;
    }
    const numericDuration = parseInt(serviceForm.duration, 10);
    if (isNaN(numericDuration) || numericDuration <= 0) {
      toast.error('Durée invalide (en minutes)');
      return;
    }

    setIsSavingService(true);
    try {
      if (editingService) {
        // Update existing service
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: serviceForm.name.trim(),
            description: serviceForm.description.trim() || null,
            price: numericPrice,
            duration: numericDuration,
            category: serviceForm.category,
            image: serviceForm.image.trim() || null,
            coverage: serviceForm.coverage === 'EXTERIOR' ? 'EXTERIOR' : 'FULL',
          }),
        });
        const data = await parseJsonResponse<{ success: boolean; service: Service; error?: string }>(res);
        if (!data || !data.success) {
          toast.error(data?.error || 'Erreur lors de la mise à jour du service');
          return;
        }
        setServices(prev => prev.map(s => (s.id === editingService.id ? data.service : s)));
        toast.success('Service mis à jour avec succès');
      } else {
        // Create new service via the station-scoped endpoint
        const res = await fetch(`/api/stations/${washer.stationId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: serviceForm.name.trim(),
            description: serviceForm.description.trim() || null,
            price: numericPrice,
            duration: numericDuration,
            category: serviceForm.category,
            image: serviceForm.image.trim() || null,
            coverage: serviceForm.coverage === 'EXTERIOR' ? 'EXTERIOR' : 'FULL',
          }),
        });
        const data = await parseJsonResponse<{ success: boolean; service: Service; error?: string }>(res);
        if (!data || !data.success) {
          toast.error(data?.error || 'Erreur lors de la création du service');
          return;
        }
        setServices(prev => [...prev, data.service].sort((a, b) => a.price - b.price));
        toast.success('Service créé avec succès');
      }
      setIsServiceDialogOpen(false);
      setEditingService(null);
    } catch (error) {
      console.error('Save service error:', error);
      toast.error('Erreur lors de l\'enregistrement du service');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = async (service: Service) => {
    if (!window.confirm(`Supprimer le service "${service.name}" ?`)) return;
    setDeletingServiceId(service.id);
    try {
      const res = await fetch(`/api/services/${service.id}`, { method: 'DELETE' });
      const data = await parseJsonResponse<{ success: boolean; error?: string }>(res);
      if (!data || !data.success) {
        toast.error(data?.error || 'Erreur lors de la suppression du service');
        return;
      }
      setServices(prev => prev.filter(s => s.id !== service.id));
      toast.success('Service supprimé');
    } catch (error) {
      console.error('Delete service error:', error);
      toast.error('Erreur lors de la suppression du service');
    } finally {
      setDeletingServiceId(null);
    }
  };

  // ---------- Render helpers ----------
  const displayName = user?.name || washer.user?.name || 'Propriétaire';

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] overflow-hidden">
      {/* Android Status Bar — aperçu desktop uniquement */}
      <div className="h-6 bg-[#FF9800] hidden md:flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-50">
        <span className="text-white text-xs font-medium">
          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
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

      {/* Header — sur mobile il colle au haut (pas de barre factice) + safe-area */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0 sticky top-0 md:top-6 z-40 max-md:pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-[#212121]">{displayName}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFE0B2] text-[#E65100] font-medium">
                  Station
                </span>
                {station?.rating ? (
                  <>
                    <Star className="w-3.5 h-3.5 text-[#FFC107] fill-[#FFC107]" />
                    <span className="text-xs text-[#757575]">{station.rating.toFixed(1)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              fetchStation();
              fetchServices();
              fetchOrders();
            }}
            className="text-[#FF9800] hover:bg-[#FFF3E0]"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {activeTab === 'station' && (
          <StationInfoSection
            station={station}
            isLoading={isLoadingStation}
            onEdit={openStationDialog}
          />
        )}
        {activeTab === 'services' && (
          <ServicesSection
            services={services}
            isLoading={isLoadingServices}
            onAdd={openAddServiceDialog}
            onEdit={openEditServiceDialog}
            onDelete={handleDeleteService}
            deletingServiceId={deletingServiceId}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersSection orders={orders} isLoading={isLoadingOrders} onRefresh={fetchOrders} />
        )}
        {activeTab === 'profile' && (
          <StationProfileSection
            displayName={displayName}
            phone={user?.phone || washer.user?.phone || ''}
            station={station}
            onLogout={onLogout}
          />
        )}
      </div>

      {/* Bottom navigation (safe-area iOS incluse) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E0] flex justify-around items-stretch h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        {[
          { id: 'station', icon: Building2, label: 'Station' },
          { id: 'services', icon: Tag, label: 'Services' },
          { id: 'orders', icon: ShoppingBag, label: 'Commandes' },
          { id: 'profile', icon: Settings, label: 'Profil' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 active:bg-[#F5F5F5] ${
                isActive ? 'text-[#FF9800]' : 'text-[#757575]'
              }`}
            >
              <tab.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Station edit dialog */}
      <Dialog open={isStationDialogOpen} onOpenChange={setIsStationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la station</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations de votre station de lavage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="station-name">Nom de la station *</Label>
              <Input
                id="station-name"
                value={stationForm.name}
                onChange={(e) => setStationForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Socline Premium Wash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-address">Adresse *</Label>
              <Input
                id="station-address"
                value={stationForm.address}
                onChange={(e) => setStationForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ex: Boulevard du Mono, Lomé"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="station-phone">Téléphone</Label>
                <Input
                  id="station-phone"
                  value={stationForm.phone}
                  onChange={(e) => setStationForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+228 90 00 00 00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="station-email">Email</Label>
                <Input
                  id="station-email"
                  type="email"
                  value={stationForm.email}
                  onChange={(e) => setStationForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="station@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-description">Description</Label>
              <Textarea
                id="station-description"
                value={stationForm.description}
                onChange={(e) => setStationForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez votre station..."
                rows={3}
              />
            </div>

            {/* Photos de la station (devanture...) */}
            <div className="space-y-2">
              <Label>Photos de la station (devanture, enseigne…)</Label>
              <div className="flex flex-wrap gap-2">
                {stationForm.images.map((img, index) => (
                  <div key={index} className="relative w-20 h-20">
                    { }
                    <img
                      src={img}
                      alt={`Photo ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-[#E0E0E0]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveStationImage(index)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#E53935] text-white rounded-full flex items-center justify-center shadow-sm"
                      aria-label={`Retirer la photo ${index + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 bg-[#212121] text-white text-[9px] text-center rounded-b-lg py-0.5">
                        Devanture
                      </span>
                    )}
                  </div>
                ))}
                {stationForm.images.length < 5 && (
                  <label
                    htmlFor="station-images-input"
                    className={`w-20 h-20 rounded-lg border-2 border-dashed border-[#FFB74D] bg-[#FFF8F0] flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#FFF3E0] transition-colors ${isUploadingImages ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    {isUploadingImages ? (
                      <Loader2 className="w-5 h-5 text-[#FF9800] animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5 text-[#FF9800]" />
                        <span className="text-[10px] text-[#E65100] font-medium">Ajouter</span>
                      </>
                    )}
                  </label>
                )}
              </div>
              <input
                id="station-images-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddStationImages}
              />
              <p className="text-xs text-[#9E9E9E]">
                La première photo sert de devanture visible par les clients (max 5, compression automatique).
              </p>
            </div>

            {/* Position GPS */}
            <div className="space-y-2">
              <Label>Localisation GPS (guide les clients vers vous)</Label>
              {stationForm.latitude && stationForm.longitude ? (
                <div className="flex items-center justify-between bg-[#E8F5E9] border border-[#A5D6A7] rounded-lg p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <LocateFixed className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
                    <span className="text-xs text-[#2E7D32] truncate">
                      Position enregistrée ({parseFloat(stationForm.latitude).toFixed(4)}, {parseFloat(stationForm.longitude).toFixed(4)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStationForm(prev => ({ ...prev, latitude: '', longitude: '' }))}
                    className="text-xs text-[#C62828] font-medium flex-shrink-0 ml-2"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#9E9E9E]">
                  Aucune position GPS — les clients seront guidés par l'adresse uniquement.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentPosition}
                disabled={isGettingPosition}
                className="w-full h-11 border-[#4CAF50] text-[#2E7D32] hover:bg-[#E8F5E9]"
              >
                {isGettingPosition ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Localisation…
                  </>
                ) : (
                  <>
                    <LocateFixed className="w-4 h-4 mr-2" /> Utiliser ma position actuelle
                  </>
                )}
              </Button>
              <p className="text-xs text-[#9E9E9E]">
                Placez-vous devant votre station, puis appuyez sur ce bouton : les clients pourront
                lancer un itinéraire directement depuis l'application.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStationDialogOpen(false)}
              disabled={isSavingStation}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveStation}
              disabled={isSavingStation}
              className="bg-[#FF9800] hover:bg-[#F57C00] text-white"
            >
              {isSavingStation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service add/edit dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
        setIsServiceDialogOpen(open);
        if (!open) setEditingService(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Modifier le service' : 'Nouveau service'}</DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Mettez à jour les informations de ce service.'
                : 'Ajoutez un nouveau service ou tarif à votre station.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="service-name">Nom du service *</Label>
              <Input
                id="service-name"
                value={serviceForm.name}
                onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Lavage extérieur premium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                value={serviceForm.description}
                onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez ce qui est inclus..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service-price">Prix (XOF) *</Label>
                <Input
                  id="service-price"
                  type="number"
                  inputMode="decimal"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Durée (min) *</Label>
                <Input
                  id="service-duration"
                  type="number"
                  inputMode="numeric"
                  value={serviceForm.duration}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-category">Catégorie</Label>
              <Select
                value={serviceForm.category}
                onValueChange={(value) => setServiceForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="service-category" className="w-full">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-coverage">Prestation</Label>
              <Select
                value={serviceForm.coverage}
                onValueChange={(value) => setServiceForm(prev => ({ ...prev, coverage: value }))}
              >
                <SelectTrigger id="service-coverage" className="w-full">
                  <SelectValue placeholder="Choisir la prestation" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_COVERAGES.map((cov) => (
                    <SelectItem key={cov.value} value={cov.value}>
                      {cov.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#757575]">
                « Extérieur seul » ne couvre que la carrosserie. « Complet » inclut aussi l'intérieur.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-image">URL de l'image</Label>
              <Input
                id="service-image"
                value={serviceForm.image}
                onChange={(e) => setServiceForm(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsServiceDialogOpen(false);
                setEditingService(null);
              }}
              disabled={isSavingService}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveService}
              disabled={isSavingService}
              className="bg-[#FF9800] hover:bg-[#F57C00] text-white"
            >
              {isSavingService ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...
                </>
              ) : (
                editingService ? 'Mettre à jour' : 'Créer le service'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Sub-components ----------

function StationInfoSection({
  station,
  isLoading,
  onEdit,
}: {
  station: Station | null;
  isLoading: boolean;
  onEdit: () => void;
}) {
  if (isLoading && !station) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="p-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-[#FF9800] mx-auto mb-3" />
            <p className="font-medium text-[#212121]">Aucune station associée</p>
            <p className="text-sm text-[#757575] mt-1">
              Votre compte n&apos;est pas encore lié à une station. Contactez le support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Station hero card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 flex-shrink-0" />
                <h2 className="text-lg font-bold truncate">{station.name}</h2>
              </div>
              {station.rating > 0 ? (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-white text-white" />
                  <span className="text-sm">{station.rating.toFixed(1)}</span>
                  <span className="text-xs text-[#FFF3E0]">
                    ({station.totalRatings} avis)
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#FFF3E0]">Pas encore d&apos;avis</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={onEdit}
              className="bg-white text-[#FF9800] hover:bg-[#FFF3E0] flex-shrink-0"
            >
              <Edit className="w-4 h-4 mr-1" /> Modifier
            </Button>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#FF9800] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-[#757575]">Adresse</p>
              <p className="text-sm text-[#212121] break-words">{station.address}</p>
            </div>
          </div>
          {station.phone ? (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#FF9800] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-[#757575]">Téléphone</p>
                <p className="text-sm text-[#212121]">{station.phone}</p>
              </div>
            </div>
          ) : null}
          {station.description ? (
            <div className="pt-2 border-t border-[#E0E0E0]">
              <p className="text-xs text-[#757575] mb-1">Description</p>
              <p className="text-sm text-[#212121]">{station.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
                <Star className="w-5 h-5 text-[#FF9800]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Note</p>
                <p className="text-lg font-bold text-[#FF9800]">
                  {station.rating > 0 ? station.rating.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#FF9800]" />
              </div>
              <div>
                <p className="text-xs text-[#757575]">Avis clients</p>
                <p className="text-lg font-bold text-[#FF9800]">{station.totalRatings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ServicesSection({
  services,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  deletingServiceId,
}: {
  services: Service[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  deletingServiceId: string | null;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[#212121]">Services & tarifs</h2>
          <p className="text-xs text-[#757575]">
            {services.length} service{services.length !== 1 ? 's' : ''} proposé{services.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={onAdd}
          className="bg-[#FF9800] hover:bg-[#F57C00] text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-[#FF9800] mx-auto mb-3" />
            <p className="font-medium text-[#212121]">Aucun service pour le moment</p>
            <p className="text-sm text-[#757575] mt-1 mb-4">
              Créez votre premier service ou tarif pour que les clients puissent réserver.
            </p>
            <Button
              onClick={onAdd}
              className="bg-[#FF9800] hover:bg-[#F57C00] text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> Créer un service
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id} className="border-0 shadow-sm border-l-4 border-l-[#FF9800]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-[#212121] truncate">{service.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFF3E0] text-[#E65100] uppercase tracking-wide">
                        {service.category}
                      </span>
                      <CoverageBadge service={service} short />
                    </div>
                    {service.description ? (
                      <p className="text-sm text-[#757575] line-clamp-2 mb-2">
                        {service.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-[#FF9800] font-semibold">
                        <DollarSign className="w-4 h-4" />
                        {service.price.toLocaleString('fr-FR')} XOF
                      </span>
                      <span className="flex items-center gap-1 text-[#757575]">
                        <Clock className="w-4 h-4" />
                        {service.duration} min
                      </span>
                      {service.image ? (
                        <span className="flex items-center gap-1 text-[#9E9E9E] text-xs">
                          <ImageIcon className="w-3.5 h-3.5" /> Image
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(service)}
                      className="h-8 w-8 p-0 text-[#FF9800] hover:bg-[#FFF3E0]"
                      aria-label="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(service)}
                      disabled={deletingServiceId === service.id}
                      className="h-8 w-8 p-0 text-[#E53935] hover:bg-[#FFEBEE]"
                      aria-label="Supprimer"
                    >
                      {deletingServiceId === service.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersSection({
  orders,
  isLoading,
  onRefresh,
}: {
  orders: Order[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[#212121]">Commandes de la station</h2>
          <p className="text-xs text-[#757575]">
            {orders.length} commande{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={onRefresh}
          variant="ghost"
          size="sm"
          className="text-[#FF9800] hover:bg-[#FFF3E0]"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-[#FF9800] mx-auto mb-3" />
            <p className="font-medium text-[#212121]">Aucune commande pour le moment</p>
            <p className="text-sm text-[#757575] mt-1">
              Les commandes passées par les clients apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const statusColor = ORDER_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800';

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs text-[#9E9E9E] font-mono">#{order.orderNumber}</p>
            <p className="font-semibold text-[#212121] truncate">
              {order.service?.name || 'Service'}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-[#757575]">
            <UserIcon className="w-4 h-4 text-[#FF9800]" />
            <span>{order.client?.name || 'Client'}</span>
            {order.client?.phone ? (
              <span className="text-xs text-[#9E9E9E]">· {order.client.phone}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[#757575]">
            <Calendar className="w-4 h-4 text-[#FF9800]" />
            <span>
              {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E0E0E0]">
          <span className="text-xs text-[#757575]">
            {order.isHomeService ? 'À domicile' : 'Sur place'}
          </span>
          <span className="font-bold text-[#FF9800]">
            {(order.totalPrice ?? 0).toLocaleString('fr-FR')} XOF
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StationProfileSection({
  displayName,
  phone,
  station,
  onLogout,
}: {
  displayName: string;
  phone: string;
  station: Station | null;
  onLogout?: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 text-center">
          <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h2 className="font-semibold text-[#212121]">{displayName}</h2>
          <p className="text-sm text-[#757575]">{phone}</p>
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[#FFE0B2] text-[#E65100] font-medium">
            Propriétaire de station
          </span>
        </CardContent>
      </Card>

      {station ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-[#212121] text-sm">Ma station</h3>
            {(() => {
              const photos = parseStationImages(station.images);
              const hasGps = station.latitude != null && station.longitude != null;
              return (
                <>
                  {photos.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {photos.map((img, i) => (
                        <div key={i} className="relative flex-shrink-0">
                          { }
                          <img
                            src={img}
                            alt={`Photo ${i + 1} de ${station.name}`}
                            className="w-32 h-24 object-cover rounded-lg border border-[#E0E0E0]"
                          />
                          {i === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-[#212121] text-white text-[9px] text-center rounded-b-lg py-0.5">
                              Devanture
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-24 rounded-lg bg-[#FFF3E0] flex flex-col items-center justify-center gap-1">
                      <ImageIcon className="w-6 h-6 text-[#FFB74D]" />
                      <p className="text-xs text-[#E65100]">Aucune photo — ajoutez votre devanture</p>
                    </div>
                  )}
                  <div className="text-sm space-y-1.5 text-[#757575]">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#FF9800]" />
                      <span>{station.name}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#FF9800] mt-0.5" />
                      <span className="break-words">{station.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LocateFixed className={`w-4 h-4 ${hasGps ? 'text-[#4CAF50]' : 'text-[#BDBDBD]'}`} />
                      <span className={hasGps ? 'text-[#2E7D32]' : ''}>
                        {hasGps
                          ? `Position GPS enregistrée (${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)})`
                          : 'Position GPS non définie'}
                      </span>
                    </div>
                    {station.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#FF9800]" />
                        <span>{station.phone}</span>
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={buildStationDirectionsUrl(station.latitude, station.longitude, station.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-10 bg-[#E8F5E9] text-[#2E7D32] rounded-lg text-sm font-medium hover:bg-[#C8E6C9] transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Voir ma position sur Google Maps
                  </a>
                </>
              );
            })()}
          </CardContent>
        </Card>
      ) : null}

      <Button
        variant="outline"
        onClick={onLogout}
        className="w-full border-[#E53935] text-[#E53935] hover:bg-[#FFEBEE] hover:text-[#E53935]"
      >
        <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
      </Button>
    </div>
  );
}

export default StationDashboard;
