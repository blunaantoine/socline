'use client';

import { useState, useEffect } from 'react';
import { useServicesStore, useOrdersStore, useAppStore, useAuthStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, MapPin, Clock, CreditCard, Wallet,
  CheckCircle, AlertCircle, Loader2,
  Zap, Crown, Calendar, Car, Building2, Droplets
} from 'lucide-react';
import { toast } from 'sonner';
import { MediaCarousel } from './MediaCarousel';
import { CarPhoto } from '@/components/shared/CarPhoto';
import type { Service, Order, Car as CarType } from '@/types';
import { parseJsonResponse } from '@/lib/json-helper';
import { DynamicLeafletMap } from '@/components/map/DynamicLeafletMap';
import { COVERAGE_LONG_LABEL, getServiceCoverage, formatPrice } from '@/lib/service-coverage';
import { ServiceRowCard } from '@/components/design/ServiceRowCard';
import { EmptyState } from '@/components/design/EmptyState';
import { BTN_PRIMARY_CLASSES, CARD_CLASSES } from '@/lib/design-system';

interface ClientOrderFlowProps {
  onBack: () => void;
  onOrderComplete?: () => void;
  // Presets from ClientApp when the user clicks a specific service (e.g. a station service)
  presetIsHomeService?: boolean;
  presetStationId?: string | null;
  presetAddress?: string;
}

type StepType = 'service' | 'location' | 'schedule' | 'payment';

/** Pastille radio réutilisable (cercle fin + point orange si coché). */
function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 grid place-items-center flex-shrink-0 transition-colors ${
        checked ? 'border-brand' : 'border-line'
      }`}
      aria-hidden="true"
    >
      {checked && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
    </span>
  );
}

/** Skeleton d'une carte formule (chargement étape Service). */
function ServiceSkeleton() {
  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden animate-pulse">
      <div className="h-[92px] bg-line/60" />
      <div className="px-3 pt-2.5 pb-3 space-y-2">
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-3 w-1/2 rounded bg-line/70" />
      </div>
    </div>
  );
}

const STEPS: { id: StepType; label: string; icon: typeof Droplets }[] = [
  { id: 'service', label: 'Service', icon: Droplets },
  { id: 'location', label: 'Adresse', icon: MapPin },
  { id: 'schedule', label: 'Planifier', icon: Clock },
  { id: 'payment', label: 'Paiement', icon: Wallet },
];

const STEP_TITLE: Record<StepType, string> = {
  service: 'Choisir un service',
  location: 'Adresse de service',
  schedule: 'Planification',
  payment: 'Paiement',
};

export function ClientOrderFlow({
  onBack,
  onOrderComplete,
  presetIsHomeService = true,
  presetStationId = null,
  presetAddress = '',
}: ClientOrderFlowProps) {
  const { services, selectedService, selectService, setServices } = useServicesStore();
  const { setCurrentOrder, addOrder } = useOrdersStore();
  const { userLocation } = useAppStore();
  const { user } = useAuthStore();
  // If a service was preselected (e.g. from a station service click), skip the service step
  const [step, setStep] = useState<StepType>(selectedService ? 'location' : 'service');
  const [isHomeService, setIsHomeService] = useState(presetIsHomeService);
  const [address, setAddress] = useState(presetAddress || userLocation?.address || '');
  // Station ID when ordering from a station service (isHomeService = false). Preset from ClientApp.
  const [stationId, setStationId] = useState<string | null>(presetStationId);
  const [scheduledTime, setScheduledTime] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash'>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [useSubscription, setUseSubscription] = useState(false);
  // "Utiliser ma position actuelle" (étape adresse)
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  // Vehicle selection (étape adresse) — the washer relies on it to
  // recognize the car. Defaults to the client's default car.
  const [cars, setCars] = useState<CarType[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  // Détail d'un service (pastille info de l'étape 1) — affichage pur
  const [infoService, setInfoService] = useState<Service | null>(null);

  // Fetch services on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        const seedCheck = await fetch('/api/seed');
        const seedData = await parseJsonResponse<any>(seedCheck);
        
        if (!seedData || !seedData.seeded || seedData.servicesCount === 0) {
          await fetch('/api/seed', { method: 'POST' });
        }

        const res = await fetch('/api/services');
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        
        if (data.success && data.services) {
          setServices(data.services);
        }
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setIsLoadingServices(false);
      }
    };

    loadServices();
  }, [setServices]);

  // Fetch the client's cars (vehicle recognition for the washer)
  useEffect(() => {
    const loadCars = async () => {
      try {
        const res = await fetch('/api/cars');
        const data = await parseJsonResponse<any>(res);
        if (data?.success && Array.isArray(data.cars)) {
          setCars(data.cars);
          const preferred = data.cars.find((c: CarType) => c.isDefault) || data.cars[0];
          if (preferred) setSelectedCarId(preferred.id);
        }
      } catch {
        // Cars are optional — the order can still be created without one.
      }
    };
    loadCars();
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWallet = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/wallet?userId=${user.id}`);
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        if (data.success && data.wallet) {
          setWalletBalance(data.wallet.balance);
        }
      } catch (error) {
        console.error('Error fetching wallet:', error);
      }
    };
    fetchWallet();
  }, [user?.id]);

  // Fetch active subscription for current service
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user?.id || !selectedService) return;
      try {
        const res = await fetch(`/api/subscriptions/user?userId=${user.id}`);
        const data = await parseJsonResponse<any>(res);
        if (!data) return;
        if (data.success && data.subscriptions) {
          // Find active subscription for this service
          const active = data.subscriptions.find((sub: any) => 
            sub.isActive && 
            !sub.isExpired && 
            sub.remainingWashes > 0 &&
            sub.plan?.serviceId === selectedService.id
          );
          setActiveSubscription(active || null);
          setUseSubscription(!!active);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    };
    fetchSubscription();
  }, [user?.id, selectedService]);

  const goToStep = (newStep: StepType) => {
    setStep(newStep);
  };

  const handleServiceSelect = (service: Service) => {
    selectService(service);
    goToStep('location');
  };

  const handleLocationSubmit = () => {
    if (!address) return;
    goToStep('schedule');
  };

  const handleScheduleSubmit = () => {
    goToStep('payment');
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Impossible d\'obtenir votre position');
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setAddress('Position actuelle');
        setIsGettingLocation(false);
      },
      () => {
        setIsGettingLocation(false);
        toast.error('Impossible d\'obtenir votre position');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleApplyPromo = async () => {
    if (!promoCode || !selectedService) return;
    
    setIsValidatingPromo(true);
    setPromoError('');
    
    try {
      const res = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode,
          userId: user?.id,
          orderAmount: selectedService.price,
        }),
      });
      
      const data = await parseJsonResponse<any>(res);
      if (!data) return;
      
      if (data.success) {
        setAppliedPromo(data.promotion);
        setPromoError('');
      } else {
        setPromoError(data.error || 'Code promo invalide');
        setAppliedPromo(null);
      }
    } catch (error) {
      setPromoError('Erreur lors de la validation');
      setAppliedPromo(null);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const getFinalPrice = () => {
    if (!selectedService) return 0;
    // If using subscription, price is 0
    if (useSubscription && activeSubscription) {
      return 0;
    }
    const basePrice = selectedService.price;
    if (appliedPromo) {
      return Math.max(0, basePrice - appliedPromo.discountAmount);
    }
    return basePrice;
  };

  const handlePaymentSubmit = async () => {
    if (!selectedService) return;
    
    const clientId = user?.id;
    
    if (!clientId) {
      toast.error('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const finalPrice = getFinalPrice();
    if (paymentMethod === 'wallet' && walletBalance < finalPrice) {
      toast.error('Solde insuffisant dans votre portefeuille.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          serviceId: selectedService.id,
          isHomeService,
          stationId: stationId || null,
          carId: selectedCarId || null,
          address,
          latitude: coords?.latitude ?? userLocation?.latitude,
          longitude: coords?.longitude ?? userLocation?.longitude,
          totalPrice: finalPrice,
          promoCode: appliedPromo?.code || null,
          discount: appliedPromo?.discountAmount || 0,
          scheduledAt: scheduledTime === 'later' ? scheduledDate : null,
          useSubscription: useSubscription && activeSubscription,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success && data.order) {
        if (paymentMethod === 'wallet') {
          const walletRes = await fetch('/api/wallet', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: clientId,
              orderId: data.order.id,
              amount: finalPrice,
            }),
          });
          
          const walletData = await parseJsonResponse<any>(walletRes);
          if (!walletData || !walletData.success) {
            toast.error('Erreur lors du paiement par portefeuille.');
          }
        }

        await fetch('/api/orders/' + data.order.id + '/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: clientId,
            amount: finalPrice,
            // Séance abonnement : rien à encaisser sur place — la prestation
            // est déjà réglée via l'abonnement (la route force aussi WALLET).
            method: useSubscription && activeSubscription
              ? 'WALLET'
              : paymentMethod === 'wallet' ? 'WALLET' : 'CASH',
          }),
        });

        const order: Order = {
          id: data.order.id,
          orderNumber: data.order.orderNumber,
          clientId: data.order.clientId,
          client: data.order.client,
          serviceId: data.order.serviceId,
          service: data.order.service,
          isHomeService: data.order.isHomeService,
          address: data.order.address,
          latitude: data.order.latitude,
          longitude: data.order.longitude,
          carId: data.order.carId,
          car: data.order.car,
          basePrice: data.order.basePrice,
          discount: appliedPromo?.discountAmount || 0,
          totalPrice: data.order.totalPrice,
          commission: data.order.commission,
          status: data.order.status,
          scheduledAt: data.order.scheduledAt,
          createdAt: data.order.createdAt,
          updatedAt: data.order.updatedAt,
        };

        setCurrentOrder(order);
        addOrder(order);
        
        if (onOrderComplete) {
          onOrderComplete();
        }
      } else {
        if (data.error?.includes('reconnecter')) {
          toast.error('Session expirée. Veuillez vous reconnecter.');
          window.location.reload();
          return;
        }
        toast.error(data.error || 'Erreur lors de la création de la commande');
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Erreur de connexion. Réessayez.');
    } finally {
      setIsProcessing(false);
    }
  };

  const goBack = () => {
    if (step === 'service') {
      onBack();
    } else if (step === 'location') {
      goToStep('service');
    } else if (step === 'schedule') {
      goToStep('location');
    } else if (step === 'payment') {
      goToStep('schedule');
    }
  };

  if (isLoadingServices) {
    return (
      <div className="flex-1 flex flex-col bg-app">
        <div className="bg-surface border-b border-line px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex-shrink-0">
          <div className="h-5 w-44 rounded bg-line animate-pulse" />
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ServiceSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-app">
      {/* Header : retour + titre de l'étape + service choisi */}
      <div className="bg-surface border-b border-line px-4 py-3 flex-shrink-0 sticky top-0 z-40 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            aria-label="Retour"
            className="w-10 h-10 rounded-btn border border-line grid place-items-center flex-shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-ink" strokeWidth={2.2} />
          </button>
          <div className="min-w-0">
            <h1 className="text-section text-ink leading-tight">{STEP_TITLE[step]}</h1>
            {selectedService && step !== 'service' && (
              <p className="text-detail text-soft truncate">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-surface px-4 py-2.5 border-b border-line flex-shrink-0 sticky top-[calc(4rem+env(safe-area-inset-top))] z-30">
        <div className="flex items-center justify-between">
          {STEPS.map((item, index) => {
            const isActive = step === item.id;
            const stepIndex = STEPS.findIndex(s => s.id === step);
            const isPast = index < stepIndex;
            
            return (
              <div key={item.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full grid place-items-center transition-colors ${
                      isActive
                        ? 'bg-brand text-white'
                        : isPast
                        ? 'bg-success text-white'
                        : 'bg-line text-soft'
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <item.icon className="w-4 h-4" strokeWidth={2.2} />
                    )}
                  </div>
                  <span className={`text-micro mt-1 ${
                    isActive ? 'text-brand' : isPast ? 'text-success' : 'text-soft'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${isPast ? 'bg-success' : 'bg-line'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content - Only render current step */}
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Étape 1 : choisir une formule — rangées horizontales (maquette) */}
        {step === 'service' && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <EmptyState icon={AlertCircle} message="Aucun service disponible pour le moment" />
            ) : (
              <div className="space-y-3">
                {services.map((service, index) => (
                  <ServiceRowCard
                    key={service.id}
                    service={service}
                    index={index}
                    onClick={() => handleServiceSelect(service)}
                    onInfo={() => setInfoService(service)}
                  />
                ))}
              </div>
            )}

            {/* Carrousel média (images + vidéos) en bas de l'étape de choix du service */}
            <MediaCarousel />

            {/* Modale info : description complète du service (au toucher) */}
            <Dialog open={!!infoService} onOpenChange={(open) => !open && setInfoService(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-title text-ink">{infoService?.name}</DialogTitle>
                </DialogHeader>
                {infoService && (
                  <div className="space-y-4">
                    <p className="text-body text-soft leading-relaxed">{infoService.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-micro font-semibold rounded-pill bg-brand-soft text-brand-deep px-2.5 py-1">
                        {infoService.duration} min
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline bg-brand-wash rounded-btn p-3.5">
                      <span className="text-body text-soft">Prix</span>
                      <span className="font-extrabold text-lg text-ink">
                        {infoService.price.toLocaleString('fr-FR')} <span className="text-brand text-sm">F</span>
                      </span>
                    </div>
                    <Button
                      className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
                      onClick={() => {
                        const s = infoService;
                        setInfoService(null);
                        if (s) handleServiceSelect(s);
                      }}
                    >
                      Choisir ce service
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Étape 2 : adresse / station / véhicule */}
        {step === 'location' && selectedService && (
          <div className="space-y-4">
            <div className={`p-4 ${CARD_CLASSES}`}>
              <Label className="text-section text-ink mb-3 block">Type de service</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-4 rounded-btn border text-center transition-all active:scale-[0.98] ${
                    isHomeService ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  } ${stationId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !stationId && setIsHomeService(true)}
                >
                  <MapPin className={`w-6 h-6 mx-auto mb-2 ${isHomeService ? 'text-brand' : 'text-soft'}`} strokeWidth={2} />
                  <span className="text-body font-bold text-ink block">À domicile</span>
                  <span className="text-detail text-soft mt-0.5 block">Le laveur vient chez vous</span>
                </button>
                <button
                  className={`p-4 rounded-btn border text-center transition-all active:scale-[0.98] ${
                    !isHomeService ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  } ${stationId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !stationId && setIsHomeService(false)}
                >
                  <Building2 className={`w-6 h-6 mx-auto mb-2 ${!isHomeService ? 'text-brand' : 'text-soft'}`} strokeWidth={2} />
                  <span className="text-body font-bold text-ink block">En station</span>
                  <span className="text-detail text-soft mt-0.5 block">Vous allez à la station</span>
                </button>
              </div>
            </div>

            <div className={`p-4 ${CARD_CLASSES}`}>
              <Label className="text-section text-ink mb-3 block">
                {isHomeService ? 'Adresse de service' : 'Station de lavage'}
              </Label>
              {isHomeService ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Entrez votre adresse"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-12 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30"
                  />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isGettingLocation}
                    className="inline-flex items-center gap-2 text-detail font-semibold text-brand bg-brand-soft rounded-pill px-3 py-2 disabled:opacity-60 active:scale-95 transition-transform"
                  >
                    {isGettingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : address === 'Position actuelle' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    <span>
                      {isGettingLocation
                        ? 'Localisation…'
                        : address === 'Position actuelle'
                        ? 'Position actuelle'
                        : 'Utiliser ma position actuelle'}
                    </span>
                  </button>

                  {/* Map picker — tap to drop/adjust the service pin. Guarantees
                      GPS coordinates even when the text address is typed manually. */}
                  <div className="rounded-card overflow-hidden border border-line">
                    <DynamicLeafletMap
                      center={coords ? [coords.latitude, coords.longitude] : [6.1725, 1.2314]}
                      zoom={coords ? 15 : 13}
                      height="220px"
                      onMapClick={(lat, lng) => {
                        setCoords({ latitude: lat, longitude: lng });
                        setAddress((prev) =>
                          prev && prev !== 'Position actuelle' && prev !== 'Position sur la carte'
                            ? prev
                            : 'Position sur la carte'
                        );
                      }}
                      selectedPosition={coords ? [coords.latitude, coords.longitude] : null}
                    />
                  </div>
                  <p className="text-detail text-soft flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-brand" />
                    {coords
                      ? 'Position enregistrée — touchez la carte pour l\u2019ajuster'
                      : 'Touchez la carte pour définir votre position exacte'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stationId && presetAddress ? (
                    <div className="w-full p-3.5 rounded-btn border border-brand bg-brand-wash text-left">
                      <div className="text-body font-bold text-ink flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-brand" />
                        Station sélectionnée
                      </div>
                      <div className="text-body text-soft mt-1">{presetAddress}</div>
                      <div className="text-detail text-brand mt-1">Station prédéfinie lors de la sélection du service</div>
                    </div>
                  ) : (
                    [
                      { name: 'Auto Shine Lomé', addr: 'Centre-ville, Lomé', distance: '1.2 km' },
                      { name: 'Car Wash Bè', addr: 'Bè, Lomé', distance: '2.5 km' },
                    ].map((station, i) => (
                      <button
                        key={i}
                        className={`w-full p-3.5 rounded-btn border text-left transition-all active:scale-[0.99] ${
                          address === station.addr ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                        }`}
                        onClick={() => setAddress(station.addr)}
                      >
                        <div className="text-body font-bold text-ink">{station.name}</div>
                        <div className="text-detail text-soft">{station.addr}</div>
                        <div className="text-detail text-brand font-semibold">{station.distance}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Vehicle selection — the washer will use it to recognize the car */}
            {cars.length > 0 && (
              <div className={`p-4 ${CARD_CLASSES}`}>
                <Label className="text-section text-ink mb-3 block">
                  Quel véhicule laver ?
                </Label>
                <div className="space-y-2">
                  {cars.map((car) => {
                    const isSelected = selectedCarId === car.id;
                    return (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => setSelectedCarId(car.id)}
                        className={`w-full p-3 rounded-btn border text-left transition-all flex items-center gap-3 ${
                          isSelected ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                        }`}
                      >
                        {car.photo ? (
                          <img
                            src={car.photo}
                            alt={`Voiture ${car.plateNumber}`}
                            className="w-12 h-12 rounded-btn object-cover border border-line flex-shrink-0"
                          />
                        ) : (
                          <CarPhoto
                            alt={`Photo du véhicule ${car.plateNumber}`}
                            className="w-12 h-12 rounded-btn border border-line"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-body font-bold text-ink">
                            {[car.brand, car.model].filter(Boolean).join(' ') || 'Véhicule'}
                            {car.nickname ? <span className="text-detail font-normal text-soft"> — {car.nickname}</span> : null}
                          </div>
                          <div className="text-detail text-soft">
                            {car.color}{car.year ? ` • ${car.year}` : ''}
                          </div>
                          <Badge variant="outline" className="mt-0.5 font-mono text-micro border-line text-soft">
                            {car.plateNumber}
                          </Badge>
                        </div>
                        {isSelected && <CheckCircle className="w-5 h-5 text-brand flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-detail text-soft mt-2.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 flex-shrink-0 text-brand" />
                  Le laveur verra cette fiche pour reconnaître votre voiture (photo, plaque, couleur).
                </p>
              </div>
            )}

            <Button 
              className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
              onClick={handleLocationSubmit}
              disabled={!address}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Étape 3 : planification */}
        {step === 'schedule' && selectedService && (
          <div className="space-y-4">
            <div className={`p-4 ${CARD_CLASSES}`}>
              <Label className="text-section text-ink mb-3 block">Quand voulez-vous le lavage ?</Label>
              <div className="space-y-3">
                <button
                  className={`w-full p-4 rounded-btn border text-left transition-all active:scale-[0.99] ${
                    scheduledTime === 'now' ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  }`}
                  onClick={() => setScheduledTime('now')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-btn grid place-items-center flex-shrink-0 ${scheduledTime === 'now' ? 'bg-brand-soft' : 'bg-app'}`}>
                      <Zap className={`w-5 h-5 ${scheduledTime === 'now' ? 'text-brand' : 'text-soft'}`} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1">
                      <span className="text-body font-bold text-ink">Maintenant</span>
                      <p className="text-detail text-soft">Un laveur sera disponible dans ~15 min</p>
                    </div>
                    <RadioDot checked={scheduledTime === 'now'} />
                  </div>
                </button>
                <button
                  className={`w-full p-4 rounded-btn border text-left transition-all active:scale-[0.99] ${
                    scheduledTime === 'later' ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  }`}
                  onClick={() => setScheduledTime('later')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-btn grid place-items-center flex-shrink-0 ${scheduledTime === 'later' ? 'bg-brand-soft' : 'bg-app'}`}>
                      <Calendar className={`w-5 h-5 ${scheduledTime === 'later' ? 'text-brand' : 'text-soft'}`} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1">
                      <span className="text-body font-bold text-ink">Planifier</span>
                      <p className="text-detail text-soft">Choisissez une date et heure</p>
                    </div>
                    <RadioDot checked={scheduledTime === 'later'} />
                  </div>
                </button>
              </div>

              {scheduledTime === 'later' && (
                <div className="mt-4 space-y-4">
                  {/* Date picker */}
                  <div className="space-y-1.5">
                    <Label className="text-body font-bold text-ink flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand" />
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={scheduledDate.split('T')[0] || ''}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        const datePart = e.target.value;
                        const [, timePart] = scheduledDate.split('T');
                        const time = timePart ? timePart : '10:00:00';
                        setScheduledDate(`${datePart}T${time}`);
                      }}
                      className="h-12 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30"
                    />
                  </div>

                  {/* Time picker */}
                  <div className="space-y-1.5">
                    <Label className="text-body font-bold text-ink flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand" />
                      Heure
                    </Label>
                    <Input
                      type="time"
                      value={scheduledDate.split('T')[1]?.slice(0, 5) || ''}
                      min="07:00"
                      max="20:00"
                      onChange={(e) => {
                        const [datePart] = scheduledDate.split('T');
                        const safeDate = datePart || new Date().toISOString().split('T')[0];
                        setScheduledDate(`${safeDate}T${e.target.value}:00`);
                      }}
                      className="h-12 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30"
                    />
                    <p className="text-detail text-soft">Heures d'ouverture : 07h00 - 20h00</p>
                  </div>

                  {/* Selected date/time preview */}
                  {scheduledDate && scheduledDate.split('T')[0] && scheduledDate.split('T')[1] && (
                    <div className="bg-brand-soft border border-brand/30 rounded-btn p-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface rounded-full grid place-items-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-brand" />
                      </div>
                      <div>
                        <p className="text-detail text-soft">Rendez-vous prévu</p>
                        <p className="text-body font-bold text-ink">
                          {new Date(scheduledDate).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}{' '}
                          à{' '}
                          {new Date(scheduledDate).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
              disabled={scheduledTime === 'later' && (!scheduledDate || !scheduledDate.split('T')[0] || !scheduledDate.split('T')[1])}
              onClick={handleScheduleSubmit}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Étape 4 : paiement */}
        {step === 'payment' && selectedService && (
          <div className="space-y-4">
            {/* Abonnement actif : bandeau navy + couronne */}
            {activeSubscription && (
              <div className="bg-gradient-to-br from-ink to-ink-2 rounded-card p-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-full grid place-items-center flex-shrink-0">
                    <Crown className="w-5 h-5 text-star" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-body font-bold">{activeSubscription.plan?.displayName || 'Abonnement'}</h3>
                      <span className="text-micro bg-white/15 text-white rounded-pill px-2 py-0.5">Actif</span>
                    </div>
                    <p className="text-detail text-white/70 mt-0.5">
                      {activeSubscription.remainingWashes} séance{activeSubscription.remainingWashes > 1 ? 's' : ''} restante{activeSubscription.remainingWashes > 1 ? 's' : ''}
                    </p>
                    <div className="mt-3 flex items-center gap-2.5">
                      <button
                        onClick={() => setUseSubscription(!useSubscription)}
                        aria-label={useSubscription ? 'Utiliser mon abonnement' : 'Payer normalement'}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          useSubscription ? 'bg-brand' : 'bg-white/25'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                          useSubscription ? 'left-7 bg-white' : 'left-1 bg-white'
                        }`} />
                      </button>
                      <span className="text-detail font-semibold">
                        {useSubscription ? 'Utiliser mon abonnement' : 'Payer normalement'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Récapitulatif */}
            <div className={`p-4 ${CARD_CLASSES}`}>
              <h3 className="text-section text-ink mb-3">Récapitulatif</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-body">
                  <span className="text-soft">Service</span>
                  <span className="font-semibold text-ink text-right">{selectedService.name}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-soft">Prestation</span>
                  <span className="text-right text-ink">
                    {COVERAGE_LONG_LABEL[getServiceCoverage(selectedService)]}
                  </span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-soft">Type</span>
                  <span className="text-ink flex items-center gap-1.5">
                    {isHomeService ? (
                      <><MapPin className="w-3.5 h-3.5 text-brand" /> À domicile</>
                    ) : (
                      <><Building2 className="w-3.5 h-3.5 text-brand" /> En station</>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-soft">Adresse</span>
                  <span className="text-right text-ink max-w-[150px] truncate">{address}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-soft">Quand</span>
                  <span className="text-ink">{scheduledTime === 'now' ? 'Maintenant' : new Date(scheduledDate).toLocaleString('fr-FR')}</span>
                </div>
                <div className="h-px bg-line my-2" />
                
                {useSubscription && activeSubscription ? (
                  <>
                    <div className="flex justify-between text-body">
                      <span className="text-soft">Prix de base</span>
                      <span className="text-soft line-through">{formatPrice(selectedService.price)}</span>
                    </div>
                    <div className="flex justify-between text-body font-semibold text-success">
                      <span>Abonnement</span>
                      <span>1 séance déduite</span>
                    </div>
                    <div className="flex justify-between text-title text-ink pt-1.5 items-baseline">
                      <span>Total</span>
                      <span className="text-success font-extrabold">GRATUIT</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-body">
                      <span className="text-soft">Prix de base</span>
                      <span className="text-ink">{formatPrice(selectedService.price)}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-body font-semibold text-success">
                        <span>Réduction</span>
                        <span>-{formatPrice(appliedPromo.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-title text-ink pt-1.5 items-baseline">
                      <span>Total</span>
                      <span className="text-brand font-extrabold">{formatPrice(getFinalPrice())}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Code promo — masqué si abonnement utilisé */}
            {!useSubscription && (
              <div className={`p-4 ${CARD_CLASSES}`}>
                <Label className="text-section text-ink mb-3 block">Code promo</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-btn p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="font-bold text-success">{appliedPromo.code}</span>
                    </div>
                    <button onClick={handleRemovePromo} className="text-danger text-body font-semibold">
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Entrez votre code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="h-11 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30"
                    />
                    <Button
                      variant="outline"
                      className="border-brand text-brand rounded-btn font-semibold hover:bg-brand-soft"
                      onClick={handleApplyPromo}
                      disabled={!promoCode || isValidatingPromo}
                    >
                      {isValidatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                    </Button>
                  </div>
                )}
                {promoError && <p className="text-detail text-danger mt-2">{promoError}</p>}
              </div>
            )}

            {/* Mode de paiement — masqué si abonnement utilisé */}
            {!useSubscription && (
              <div className={`p-4 ${CARD_CLASSES}`}>
                <Label className="text-section text-ink mb-3 block">Mode de paiement</Label>
                <div className="space-y-3">
                {/* Portefeuille */}
                <button
                  className={`w-full p-4 rounded-btn border text-left transition-all ${
                    paymentMethod === 'wallet' ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  } ${walletBalance < getFinalPrice() ? 'opacity-60' : ''}`}
                  onClick={() => walletBalance >= getFinalPrice() && setPaymentMethod('wallet')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-brand grid place-items-center flex-shrink-0">
                        <Wallet className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-body font-bold text-ink block">Portefeuille</span>
                        <p className="text-detail text-soft truncate">Solde : {formatPrice(walletBalance)}</p>
                      </div>
                    </div>
                    {walletBalance >= getFinalPrice() ? (
                      <RadioDot checked={paymentMethod === 'wallet'} />
                    ) : (
                      <span className="text-micro text-danger font-semibold">Insuffisant</span>
                    )}
                  </div>
                </button>

                {/* Espèces */}
                <button
                  className={`w-full p-4 rounded-btn border text-left transition-all ${
                    paymentMethod === 'cash' ? 'border-brand bg-brand-wash' : 'border-line bg-surface'
                  }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-success/15 grid place-items-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-success" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-body font-bold text-ink block">Espèces</span>
                        <p className="text-detail text-soft">Payer au laveur</p>
                      </div>
                    </div>
                    <RadioDot checked={paymentMethod === 'cash'} />
                  </div>
                </button>
              </div>
            </div>
            )}

            <Button 
              className={`w-full h-14 ${BTN_PRIMARY_CLASSES} text-base font-bold`}
              onClick={handlePaymentSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : useSubscription && activeSubscription ? (
                'Confirmer avec mon abonnement'
              ) : (
                `Confirmer ${formatPrice(getFinalPrice())}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
