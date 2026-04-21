'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Settings,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Loader2,
  Home,
  Briefcase,
  MapPinned,
  Star,
  Wallet,
  Crown,
  Car,
  Eye,
  EyeOff,
  Save,
  Phone,
  Lock,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Address {
  id: string;
  label: string;
  type: 'HOME' | 'WORK' | 'OTHER';
  address: string;
  latitude?: number;
  longitude?: number;
  instructions?: string;
  isDefault: boolean;
}

interface Activity {
  id: string;
  type: 'ORDER' | 'TRANSACTION' | 'SUBSCRIPTION' | 'SUBSCRIPTION_USE';
  title: string;
  description: string;
  status: string;
  amount?: number;
  transactionType?: string;
  date: string;
  data?: any;
}

// Activity History Component
export function ActivityHistory({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'orders' | 'transactions' | 'subscriptions'>('all');

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/user/activity?userId=${userId}&type=${filter}`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.activities);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'ACCEPTED': 'bg-blue-100 text-blue-800',
      'EN_ROUTE': 'bg-blue-100 text-blue-800',
      'ARRIVED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-orange-100 text-orange-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'ACTIVE': 'bg-green-100 text-green-800',
      'EXPIRED': 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      'PENDING': 'En attente',
      'ACCEPTED': 'Acceptée',
      'EN_ROUTE': 'En route',
      'ARRIVED': 'Arrivé',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminée',
      'CANCELLED': 'Annulée',
      'ACTIVE': 'Actif',
      'EXPIRED': 'Expiré',
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getActivityIcon = (activity: Activity) => {
    switch (activity.type) {
      case 'ORDER':
        return <Car className="w-5 h-5 text-[#FF9800]" />;
      case 'TRANSACTION':
        if (activity.transactionType === 'DEPOSIT' || activity.transactionType === 'REFUND' || activity.transactionType === 'BONUS') {
          return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
        }
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case 'SUBSCRIPTION':
        return <Crown className="w-5 h-5 text-purple-500" />;
      case 'SUBSCRIPTION_USE':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-[#F5F5F5] rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#212121]" />
        </button>
        <h1 className="text-lg font-semibold text-[#212121]">Historique</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Tout' },
          { id: 'orders', label: 'Commandes' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'subscriptions', label: 'Abonnements' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              filter === f.id
                ? 'bg-[#FF9800] text-white'
                : 'bg-[#F5F5F5] text-[#757575]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activities List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune activité</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={`${activity.type}-${activity.id}`} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-[#212121] truncate">{activity.title}</h3>
                    {activity.amount !== undefined && (
                      <span className={`font-semibold text-sm ${
                        activity.type === 'TRANSACTION' &&
                        (activity.transactionType === 'DEPOSIT' || activity.transactionType === 'REFUND' || activity.transactionType === 'BONUS')
                          ? 'text-green-600'
                          : activity.type === 'TRANSACTION'
                            ? 'text-red-600'
                            : 'text-[#212121]'
                      }`}>
                        {activity.type === 'TRANSACTION' &&
                        (activity.transactionType === 'DEPOSIT' || activity.transactionType === 'REFUND' || activity.transactionType === 'BONUS')
                          ? '+'
                          : activity.type === 'TRANSACTION'
                            ? '-'
                            : ''}
                        {activity.amount?.toLocaleString()} F
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#757575] mt-1">{activity.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#9E9E9E]">{formatDate(activity.date)}</span>
                    {getStatusBadge(activity.status)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Addresses Manager Component
export function AddressesManager({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    label: '',
    type: 'HOME' as 'HOME' | 'WORK' | 'OTHER',
    address: '',
    instructions: '',
    isDefault: false
  });

  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/addresses?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const resetForm = () => {
    setFormData({
      label: '',
      type: 'HOME',
      address: '',
      instructions: '',
      isDefault: false
    });
    setEditingAddress(null);
    setShowForm(false);
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      type: address.type,
      address: address.address,
      instructions: address.instructions || '',
      isDefault: address.isDefault
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.label || !formData.address) {
      toast.error('Veuillez remplir les champs requis');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAddress) {
        // Update
        const res = await fetch(`/api/addresses/${editingAddress.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, userId })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Adresse mise à jour');
          resetForm();
          fetchAddresses();
        } else {
          toast.error(data.error || 'Erreur');
        }
      } else {
        // Create
        const res = await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, userId })
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Adresse ajoutée');
          resetForm();
          fetchAddresses();
        } else {
          toast.error(data.error || 'Erreur');
        }
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette adresse ?')) return;

    try {
      const res = await fetch(`/api/addresses/${id}?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Adresse supprimée');
        fetchAddresses();
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'HOME': return <Home className="w-5 h-5" />;
      case 'WORK': return <Briefcase className="w-5 h-5" />;
      default: return <MapPinned className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'HOME': return 'Maison';
      case 'WORK': return 'Boulot';
      default: return 'Autre';
    }
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#F5F5F5] rounded-full">
            <ArrowLeft className="w-5 h-5 text-[#212121]" />
          </button>
          <h1 className="text-lg font-semibold text-[#212121]">Mes Adresses</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-10 h-10 bg-[#FF9800] rounded-full flex items-center justify-center text-white"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
          <h3 className="font-medium text-[#212121]">
            {editingAddress ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
          </h3>

          {/* Address Type */}
          <div>
            <label className="text-xs text-[#757575]">Type</label>
            <div className="flex gap-2 mt-1">
              {(['HOME', 'WORK', 'OTHER'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFormData({ ...formData, type: t })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 ${
                    formData.type === t
                      ? 'border-[#FF9800] bg-[#FFF3E0] text-[#FF9800]'
                      : 'border-[#E0E0E0] text-[#757575]'
                  }`}
                >
                  {getTypeIcon(t)}
                  {getTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-[#757575]">Nom de l&apos;adresse *</label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Ex: Maison, Bureau, Chez maman..."
              className="mt-1"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-xs text-[#757575]">Adresse complète *</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rue du Commerce, Adidogomé"
              className="mt-1"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs text-[#757575]">Instructions (optionnel)</label>
            <Input
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Ex: Porte verte, 2ème étage..."
              className="mt-1"
            />
          </div>

          {/* Default */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 text-[#FF9800]"
            />
            <label htmlFor="isDefault" className="text-sm text-[#212121]">
              Définir comme adresse par défaut
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Addresses List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-[#9E9E9E] mx-auto mb-3" />
          <p className="text-[#757575]">Aucune adresse enregistrée</p>
          <Button
            className="mt-4 bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une adresse
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center text-[#FF9800]">
                  {getTypeIcon(address.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-[#212121]">{address.label}</h3>
                    {address.isDefault && (
                      <Badge className="bg-[#FF9800] text-white text-xs">Par défaut</Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#757575] mt-1">{address.address}</p>
                  {address.instructions && (
                    <p className="text-xs text-[#9E9E9E] mt-1">{address.instructions}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-2 hover:bg-[#F5F5F5] rounded-full"
                  >
                    <Edit className="w-4 h-4 text-[#757575]" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="p-2 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Account Settings Component
export function AccountSettings({ userId, userPhone, onBack }: { userId: string; userPhone: string; onBack: () => void }) {
  const [showPinForm, setShowPinForm] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  // PIN form
  const [pinForm, setPinForm] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });

  // Phone form
  const [phoneForm, setPhoneForm] = useState({
    newPhone: ''
  });

  const handleChangePin = async () => {
    if (!pinForm.currentPin || !pinForm.newPin || !pinForm.confirmPin) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      toast.error('Les PINs ne correspondent pas');
      return;
    }
    if (!/^\d{4}$/.test(pinForm.newPin)) {
      toast.error('Le PIN doit contenir exactement 4 chiffres');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          pin: pinForm.newPin,
          currentPin: pinForm.currentPin
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('PIN modifié avec succès');
        setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
        setShowPinForm(false);
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la modification');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePhone = async () => {
    if (!phoneForm.newPhone) {
      toast.error('Veuillez entrer un numéro');
      return;
    }
    if (!/^[79]\d{7}$/.test(phoneForm.newPhone)) {
      toast.error('Numéro invalide (doit commencer par 7 ou 9, 8 chiffres)');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          phone: phoneForm.newPhone
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Numéro modifié avec succès');
        setPhoneForm({ newPhone: '' });
        setShowPhoneForm(false);
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la modification');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-[#F5F5F5] rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#212121]" />
        </button>
        <h1 className="text-lg font-semibold text-[#212121]">Paramètres</h1>
      </div>

      {/* Phone Number Section */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-[#FF9800]" />
            </div>
            <div>
              <h3 className="font-medium text-[#212121]">Numéro de téléphone</h3>
              <p className="text-sm text-[#757575]">+228 {userPhone}</p>
            </div>
          </div>
          <button
            onClick={() => setShowPhoneForm(!showPhoneForm)}
            className="p-2 hover:bg-[#F5F5F5] rounded-full"
          >
            <Edit className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        {showPhoneForm && (
          <div className="mt-4 pt-4 border-t border-[#F5F5F5] space-y-3">
            <div>
              <label className="text-xs text-[#757575]">Nouveau numéro</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[#757575]">+228</span>
                <Input
                  value={phoneForm.newPhone}
                  onChange={(e) => setPhoneForm({ newPhone: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="90 12 34 56"
                  className="flex-1"
                  maxLength={8}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={handleChangePhone}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setShowPhoneForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PIN Section */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#FF9800]" />
            </div>
            <div>
              <h3 className="font-medium text-[#212121]">Code PIN</h3>
              <p className="text-sm text-[#757575]">••••</p>
            </div>
          </div>
          <button
            onClick={() => setShowPinForm(!showPinForm)}
            className="p-2 hover:bg-[#F5F5F5] rounded-full"
          >
            <Edit className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        {showPinForm && (
          <div className="mt-4 pt-4 border-t border-[#F5F5F5] space-y-3">
            <div className="relative">
              <label className="text-xs text-[#757575]">PIN actuel</label>
              <div className="relative">
                <Input
                  type={showCurrentPin ? 'text' : 'password'}
                  value={pinForm.currentPin}
                  onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="••••"
                  className="mt-1 pr-10"
                  maxLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPin(!showCurrentPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575]"
                >
                  {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="relative">
              <label className="text-xs text-[#757575]">Nouveau PIN</label>
              <div className="relative">
                <Input
                  type={showNewPin ? 'text' : 'password'}
                  value={pinForm.newPin}
                  onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="••••"
                  className="mt-1 pr-10"
                  maxLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#757575]"
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#757575]">Confirmer le PIN</label>
              <Input
                type="password"
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="••••"
                className="mt-1"
                maxLength={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={handleChangePin}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Modifier
              </Button>
              <Button variant="outline" onClick={() => setShowPinForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Security Info */}
      <div className="bg-[#FFF8E1] rounded-lg p-4">
        <h3 className="font-medium text-[#F57C00] mb-2">Conseils de sécurité</h3>
        <ul className="text-sm text-[#757575] space-y-1">
          <li>• Ne partagez jamais votre code PIN</li>
          <li>• Utilisez un code unique que vous seul connaissez</li>
          <li>• Changez votre PIN régulièrement</li>
        </ul>
      </div>
    </div>
  );
}
