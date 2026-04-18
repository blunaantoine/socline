'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  Car, Plus, Star, Trash2, CheckCircle, Loader2,
  Edit, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface CarData {
  id: string;
  nickname: string | null;
  plateNumber: string;
  brand: string | null;
  model: string | null;
  color: string;
  year: number | null;
  isDefault: boolean;
  createdAt: string;
}

// Car brands and their models (popular in Togo/West Africa)
const CAR_BRANDS: Record<string, string[]> = {
  'Toyota': ['Corolla', 'Camry', 'Yaris', 'RAV4', 'Hilux', 'Land Cruiser', 'Prado', 'Highlander', 'Prius', 'Auris', 'Avensis', 'Matrix'],
  'Renault': ['Clio', 'Logan', 'Sandero', 'Duster', 'Koleos', 'Captur', 'Megane', 'Scenic', 'Kangoo', 'Fluence', 'Symbol', 'Twingo'],
  'Peugeot': ['206', '207', '208', '301', '307', '308', '406', '407', '508', '2008', '3008', '5008', 'Partner'],
  'Nissan': ['Almera', 'Sentra', 'Tiida', 'Qashqai', 'X-Trail', 'Patrol', 'Navara', 'Micra', 'Juke', 'Murano', 'Sunny', 'Note'],
  'Hyundai': ['Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'i10', 'i20', 'i30', 'Kona', 'Creta', 'Matrix', 'Getz'],
  'Kia': ['Rio', 'Cerato', 'Optima', 'Sportage', 'Sorento', 'Picanto', 'Ceed', 'Soul', 'Sportage', 'Carnival', 'Morning', 'K5'],
  'Volkswagen': ['Golf', 'Polo', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'Touran', 'Caddy', 'Amarok', 'Beetle', 'Scirocco', 'Bora'],
  'Mercedes': ['Classe A', 'Classe B', 'Classe C', 'Classe E', 'Classe S', 'GLA', 'GLC', 'GLE', 'GLS', 'ML', 'CLA', 'CLS'],
  'BMW': ['Série 1', 'Série 3', 'Série 5', 'Série 7', 'X1', 'X3', 'X5', 'X6', 'X7', 'Z4', 'M3', 'M5'],
  'Ford': ['Fiesta', 'Focus', 'Fusion', 'Mondeo', 'Escape', 'Explorer', 'Ranger', 'F-150', 'EcoSport', 'Kuga', 'Edge', 'Transit'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'Fit', 'City', 'Jazz', 'HR-V', 'BR-V', 'WR-V'],
  'Mitsubishi': ['Lancer', 'Outlander', 'Pajero', 'ASX', 'Mirage', 'Eclipse Cross', 'Montero', 'Triton', 'Space Star', 'Colt', 'Galant', 'Endeavor'],
  'Mazda': ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-5', 'CX-9', 'MX-5', 'BT-50', 'Demio', 'Axela', 'Atenza', 'Premacy'],
  'Suzuki': ['Swift', 'Dzire', 'Vitara', 'S-Cross', 'Jimny', 'Ciaz', 'Baleno', 'Ertiga', 'XL7', 'Ignis', 'SX4', 'Grand Vitara'],
  'Isuzu': ['D-Max', 'MU-X', 'Trooper', 'Rodeo', 'Faster', 'Hombre', 'VehiCROSS', 'i-Series', 'Elf', 'NPR', 'NQR', 'Forward'],
  'Chevrolet': ['Spark', 'Aveo', 'Cruze', 'Malibu', 'Cruze', 'Equinox', 'Traverse', 'Tahoe', 'Suburban', 'Colorado', 'Silverado', 'Captiva'],
  'Fiat': ['Punto', 'Grande Punto', '500', 'Panda', 'Tipo', 'Linea', 'Bravo', 'Ducato', 'Fiorino', 'Doblo', 'Qubo', 'Fullback'],
  'Citroën': ['C1', 'C2', 'C3', 'C4', 'C5', 'C-Elysée', 'Berlingo', 'Picasso', 'SpaceTourer', 'DS3', 'DS4', 'DS5'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT'],
  'Lexus': ['IS', 'ES', 'GS', 'LS', 'UX', 'NX', 'RX', 'GX', 'LX', 'RC', 'LC', 'CT'],
  'Land Rover': ['Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Discovery', 'Discovery Sport', 'Defender', 'Freelander', 'Velar'],
  'Jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Patriot', 'Liberty', 'Gladiator', 'Commander'],
  'Dacia': ['Sandero', 'Logan', 'Duster', 'Lodgy', 'Dokker', 'Spring'],
  'Autre': ['Autre modèle'],
};

const BRAND_LIST = Object.keys(CAR_BRANDS);

const CAR_COLORS = [
  { value: 'Noir', label: 'Noir', bg: 'bg-gray-900' },
  { value: 'Blanc', label: 'Blanc', bg: 'bg-white border border-gray-300' },
  { value: 'Gris', label: 'Gris', bg: 'bg-gray-500' },
  { value: 'Argent', label: 'Argent', bg: 'bg-gray-400' },
  { value: 'Bleu', label: 'Bleu', bg: 'bg-blue-500' },
  { value: 'Rouge', label: 'Rouge', bg: 'bg-red-500' },
  { value: 'Vert', label: 'Vert', bg: 'bg-green-500' },
  { value: 'Marron', label: 'Marron', bg: 'bg-amber-800' },
  { value: 'Beige', label: 'Beige', bg: 'bg-amber-200' },
  { value: 'Jaune', label: 'Jaune', bg: 'bg-yellow-400' },
];

const getColorStyle = (color: string) => {
  const found = CAR_COLORS.find(c => c.value === color);
  return found?.bg || 'bg-gray-400';
};

interface CarsManagerProps {
  userId: string;
}

export function CarsManager({ userId }: CarsManagerProps) {
  const [cars, setCars] = useState<CarData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState<CarData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canAddMore, setCanAddMore] = useState(true);

  // Form state
  const [nickname, setNickname] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('Blanc');
  const [year, setYear] = useState('');

  // Fetch cars
  useEffect(() => {
    const fetchCars = async () => {
      if (!userId) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(`/api/cars?userId=${userId}`);
        const data = await res.json();
        
        if (data.success) {
          setCars(data.cars);
          setCanAddMore(data.canAddMore);
        }
      } catch (error) {
        console.error('Error fetching cars:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCars();
  }, [userId]);

  // Get available models based on selected brand
  const availableModels = brand ? CAR_BRANDS[brand] || [] : [];

  const resetForm = () => {
    setNickname('');
    setPlateNumber('');
    setBrand('');
    setModel('');
    setColor('Blanc');
    setYear('');
  };

  // Reset model when brand changes
  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    setModel(''); // Reset model when brand changes
  };

  const handleAddCar = async () => {
    if (!plateNumber || !color) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          nickname: nickname || null,
          plateNumber,
          brand: brand || null,
          model: model || null,
          color,
          year: year || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCars(prev => [data.car, ...prev]);
        setCanAddMore(cars.length + 1 < 10);
        setShowAddModal(false);
        resetForm();
        toast.success('Véhicule ajouté avec succès');
      } else {
        toast.error(data.error || 'Erreur lors de l\'ajout');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'ajout du véhicule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCar = async () => {
    if (!selectedCar || !plateNumber || !color) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: selectedCar.id,
          userId,
          nickname: nickname || null,
          plateNumber,
          brand: brand || null,
          model: model || null,
          color,
          year: year || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCars(prev => prev.map(c => c.id === data.car.id ? data.car : c));
        setShowEditModal(false);
        setSelectedCar(null);
        resetForm();
        toast.success('Véhicule mis à jour');
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCar = async (carId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) return;

    try {
      const res = await fetch(`/api/cars?carId=${carId}&userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setCars(prev => {
          const updated = prev.filter(c => c.id !== carId);
          // If we deleted the default, mark the first remaining as default
          if (updated.length > 0 && !updated.some(c => c.isDefault)) {
            updated[0].isDefault = true;
          }
          return updated;
        });
        setCanAddMore(true);
        toast.success('Véhicule supprimé');
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSetDefault = async (carId: string) => {
    try {
      const res = await fetch('/api/cars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId,
          userId,
          isDefault: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCars(prev => prev.map(c => ({
          ...c,
          isDefault: c.id === carId,
        })));
        toast.success('Véhicule par défaut mis à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const openEditModal = (car: CarData) => {
    setSelectedCar(car);
    setNickname(car.nickname || '');
    setPlateNumber(car.plateNumber);
    setBrand(car.brand || '');
    setModel(car.model || '');
    setColor(car.color);
    setYear(car.year?.toString() || '');
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF9800]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#212121]">Mes véhicules ({cars.length}/10)</h3>
        {canAddMore && (
          <Button
            size="sm"
            className="bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Cars List */}
      {cars.length === 0 ? (
        <div className="bg-white rounded-lg p-6 text-center shadow-sm">
          <Car className="w-12 h-12 text-[#BDBDBD] mx-auto mb-3" />
          <p className="text-[#757575]">Aucun véhicule enregistré</p>
          <p className="text-sm text-[#9E9E9E] mt-1">Ajoutez votre premier véhicule</p>
          <Button
            className="mt-4 bg-[#FF9800] hover:bg-[#F57C00]"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un véhicule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {cars.map((car) => (
            <div
              key={car.id}
              className={`bg-white rounded-lg p-4 shadow-sm border-2 ${
                car.isDefault ? 'border-[#FF9800]' : 'border-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Car Icon */}
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-[#FF9800]" />
                </div>

                {/* Car Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#212121]">
                      {car.nickname || `${car.brand || ''} ${car.model || ''}`.trim() || 'Mon véhicule'}
                    </span>
                    {car.isDefault && (
                      <span className="text-xs bg-[#FF9800] text-white px-2 py-0.5 rounded-full">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono text-[#757575]">{car.plateNumber}</span>
                    <div className={`w-4 h-4 rounded-full ${getColorStyle(car.color)}`} />
                    <span className="text-sm text-[#757575]">{car.color}</span>
                  </div>
                  {car.year && (
                    <p className="text-xs text-[#9E9E9E] mt-1">Année: {car.year}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!car.isDefault && (
                    <button
                      onClick={() => handleSetDefault(car.id)}
                      className="p-2 hover:bg-[#F5F5F5] rounded-lg"
                      title="Définir par défaut"
                    >
                      <CheckCircle className="w-4 h-4 text-[#9E9E9E]" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(car)}
                    className="p-2 hover:bg-[#F5F5F5] rounded-lg"
                  >
                    <Edit className="w-4 h-4 text-[#757575]" />
                  </button>
                  <button
                    onClick={() => handleDeleteCar(car.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Car Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>Ajouter un véhicule</DialogTitle>
          </VisuallyHidden>
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-[#212121]">Ajouter un véhicule</h2>

            {/* Nickname */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Surnom (optionnel)</label>
              <Input
                placeholder="Ex: Ma Clio, Voiture de travail"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Plate Number */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Numéro de plaque *</label>
              <Input
                placeholder="TG-1234-A"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              />
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#757575] mb-1 block">Marque</label>
                <Select value={brand} onValueChange={handleBrandChange}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BRAND_LIST.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#757575] mb-1 block">Modèle</label>
                <Select 
                  value={model} 
                  onValueChange={setModel}
                  disabled={!brand}
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder={brand ? "Sélectionner..." : "Choisir marque"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-sm text-[#757575] mb-2 block">Couleur *</label>
              <div className="grid grid-cols-5 gap-2">
                {CAR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                      color === c.value
                        ? 'bg-[#FFF3E0] ring-2 ring-[#FF9800]'
                        : 'hover:bg-[#F5F5F5]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${c.bg}`} />
                    <span className="text-xs mt-1 text-[#757575]">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Année</label>
              <Input
                type="number"
                placeholder="2020"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="1990"
                max={new Date().getFullYear()}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddModal(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={handleAddCar}
                disabled={isSubmitting || !plateNumber}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Car Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <VisuallyHidden>
            <DialogTitle>Modifier le véhicule</DialogTitle>
          </VisuallyHidden>
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-[#212121]">Modifier le véhicule</h2>

            {/* Nickname */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Surnom</label>
              <Input
                placeholder="Ex: Ma Clio, Voiture de travail"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Plate Number */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Numéro de plaque *</label>
              <Input
                placeholder="TG-1234-A"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              />
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[#757575] mb-1 block">Marque</label>
                <Select value={brand} onValueChange={handleBrandChange}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BRAND_LIST.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#757575] mb-1 block">Modèle</label>
                <Select 
                  value={model} 
                  onValueChange={setModel}
                  disabled={!brand}
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder={brand ? "Sélectionner..." : "Choisir marque"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-sm text-[#757575] mb-2 block">Couleur *</label>
              <div className="grid grid-cols-5 gap-2">
                {CAR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                      color === c.value
                        ? 'bg-[#FFF3E0] ring-2 ring-[#FF9800]'
                        : 'hover:bg-[#F5F5F5]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full ${c.bg}`} />
                    <span className="text-xs mt-1 text-[#757575]">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm text-[#757575] mb-1 block">Année</label>
              <Input
                type="number"
                placeholder="2020"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="1990"
                max={new Date().getFullYear()}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCar(null);
                }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-[#FF9800] hover:bg-[#F57C00]"
                onClick={handleEditCar}
                disabled={isSubmitting || !plateNumber}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
