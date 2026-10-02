'use client';

import { useState, useEffect } from 'react';
import { useServicesStore, useOrdersStore, useAppStore, useAuthStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ArrowLeft, MapPin, Clock, CreditCard, Wallet,
  CheckCircle, Star, AlertCircle, Loader2,
  Zap, Droplets, Sparkles, Crown, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import type { Service, Order } from '@/types';
import { parseJsonResponse } from '@/lib/json-helper';

interface ClientOrderFlowProps {
  onBack: () => void;
  onOrderComplete?: () => void;
  // Presets from ClientApp when the user clicks a specific service (e.g. a station service)
  presetIsHomeService?: boolean;
  presetStationId?: string | null;
  presetAddress?: string;
}

type StepType = 'service' | 'location' | 'schedule' | 'payment';

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
            method: paymentMethod === 'wallet' ? 'WALLET' : 'CASH',
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
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FF9800]" />
          <p className="mt-4 text-[#757575]">Chargement des services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-[#212121]" />
          </button>
          <div>
            <h1 className="font-semibold text-[#212121]">
              {step === 'service' && 'Choisir un service'}
              {step === 'location' && 'Adresse de service'}
              {step === 'schedule' && 'Planification'}
              {step === 'payment' && 'Paiement'}
            </h1>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white px-4 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-center justify-between">
          {[
            { id: 'service' as StepType, label: 'Service', stepNum: 1 },
            { id: 'location' as StepType, label: 'Adresse', stepNum: 2 },
            { id: 'schedule' as StepType, label: 'Planifier', stepNum: 3 },
            { id: 'payment' as StepType, label: 'Paiement', stepNum: 4 },
          ].map((item, index, arr) => {
            const isActive = step === item.id;
            const stepIndex = arr.findIndex(s => s.id === step);
            const isPast = index < stepIndex;
            
            return (
              <div key={item.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#FF9800] text-white shadow-lg'
                        : isPast
                        ? 'bg-[#4CAF50] text-white'
                        : 'bg-[#E0E0E0] text-[#9E9E9E]'
                    }`}
                  >
                    {isPast ? <CheckCircle className="w-4 h-4" /> : item.stepNum}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${
                    isActive ? 'text-[#FF9800]' : isPast ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-1 ${isPast ? 'bg-[#4CAF50]' : 'bg-[#E0E0E0]'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content - Only render current step */}
      <div className="flex-1 overflow-y-auto pb-28 p-4 bg-[#FAFAFA]">
        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-4 text-gray-500">Aucun service disponible</p>
              </div>
            ) : (
              services.map((service) => (
                <div 
                  key={service.id}
                  className="bg-white rounded-lg border-2 border-transparent hover:border-[#FF9800] shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                  onClick={() => handleServiceSelect(service)}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-[#FFF3E0] rounded-lg flex items-center justify-center flex-shrink-0">
                        {service.category === 'basic' && <Zap className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'standard' && <Droplets className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'premium' && <Sparkles className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'deluxe' && <Crown className="w-7 h-7 text-[#FF9800]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-semibold text-[#212121]">{service.name}</h3>
                          <Badge variant="secondary" className="bg-[#FFF3E0] text-[#FF9800] flex-shrink-0">{service.duration} min</Badge>
                        </div>
                        <p className="text-sm text-[#757575] mt-1">{service.description}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xl font-bold text-[#FF9800]">
                            {service.price.toLocaleString()} XOF
                          </span>
                          <span className="text-sm text-[#FF9800] font-medium">Choisir →</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Step 2: Location */}
        {step === 'location' && selectedService && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <Label className="text-base font-medium mb-3 block">Type de service</Label>
              <div className="flex gap-3">
                <button
                  className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
                    isHomeService ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200 bg-white'
                  } ${stationId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !stationId && setIsHomeService(true)}
                >
                  <MapPin className="w-6 h-6 mx-auto mb-2 text-[#FF9800]" />
                  <span className="font-medium text-[#212121]">À domicile</span>
                  <p className="text-xs text-gray-500 mt-1">Le laveur vient chez vous</p>
                </button>
                <button
                  className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
                    !isHomeService ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200 bg-white'
                  } ${stationId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !stationId && setIsHomeService(false)}
                >
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-[#FF9800]" />
                  <span className="font-medium text-[#212121]">En station</span>
                  <p className="text-xs text-gray-500 mt-1">Vous allez à la station</p>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <Label className="text-base font-medium mb-3 block">
                {isHomeService ? 'Adresse de service' : 'Station de lavage'}
              </Label>
              {isHomeService ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Entrez votre adresse"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="border-2 focus:border-[#FF9800] h-12"
                  />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isGettingLocation}
                    className="flex items-center gap-2 text-sm text-[#FF9800] font-medium disabled:opacity-60"
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
                </div>
              ) : (
                <div className="space-y-3">
                  {stationId && presetAddress ? (
                    <div className="w-full p-3 rounded-lg border-2 text-left border-[#FF9800] bg-[#FFF8F0]">
                      <div className="font-medium text-[#212121] flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#FF9800]" />
                        Station sélectionnée
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{presetAddress}</div>
                      <div className="text-xs text-[#FF9800] mt-1">Station prédéfinie lors de la sélection du service</div>
                    </div>
                  ) : (
                    [
                      { name: 'Auto Shine Lomé', addr: 'Centre-ville, Lomé', distance: '1.2 km' },
                      { name: 'Car Wash Bè', addr: 'Bè, Lomé', distance: '2.5 km' },
                    ].map((station, i) => (
                      <button
                        key={i}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                          address === station.addr ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                        }`}
                        onClick={() => setAddress(station.addr)}
                      >
                        <div className="font-medium text-[#212121]">{station.name}</div>
                        <div className="text-sm text-gray-500">{station.addr}</div>
                        <div className="text-xs text-[#FF9800]">{station.distance}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <Button 
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleLocationSubmit}
              disabled={!address}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 'schedule' && selectedService && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <Label className="text-base font-medium mb-3 block">Quand voulez-vous le lavage ?</Label>
              <div className="space-y-3">
                <button
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    scheduledTime === 'now' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                  }`}
                  onClick={() => setScheduledTime('now')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      scheduledTime === 'now' ? 'border-[#FF9800]' : 'border-gray-300'
                    }`}>
                      {scheduledTime === 'now' && <div className="w-3 h-3 bg-[#FF9800] rounded-full" />}
                    </div>
                    <div>
                      <span className="font-medium text-[#212121]">Maintenant</span>
                      <p className="text-sm text-gray-500">Un laveur sera disponible dans ~15 min</p>
                    </div>
                  </div>
                </button>
                <button
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    scheduledTime === 'later' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                  }`}
                  onClick={() => setScheduledTime('later')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      scheduledTime === 'later' ? 'border-[#FF9800]' : 'border-gray-300'
                    }`}>
                      {scheduledTime === 'later' && <div className="w-3 h-3 bg-[#FF9800] rounded-full" />}
                    </div>
                    <div>
                      <span className="font-medium text-[#212121]">Planifier</span>
                      <p className="text-sm text-gray-500">Choisissez une date et heure</p>
                    </div>
                  </div>
                </button>
              </div>

              {scheduledTime === 'later' && (
                <div className="mt-4 space-y-4">
                  {/* Date picker */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#212121] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#FF9800]" />
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
                      className="border-2 focus:border-[#FF9800] h-12"
                    />
                  </div>

                  {/* Time picker */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#212121] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#FF9800]" />
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
                      className="border-2 focus:border-[#FF9800] h-12"
                    />
                    <p className="text-xs text-gray-400">Heures d'ouverture : 07h00 - 20h00</p>
                  </div>

                  {/* Selected date/time preview */}
                  {scheduledDate && scheduledDate.split('T')[0] && scheduledDate.split('T')[1] && (
                    <div className="bg-[#FFF8F0] border border-[#FF9800]/30 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FF9800]/10 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#FF9800]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Rendez-vous prévu</p>
                        <p className="text-sm font-semibold text-[#212121]">
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
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00]"
              disabled={scheduledTime === 'later' && (!scheduledDate || !scheduledDate.split('T')[0] || !scheduledDate.split('T')[1])}
              onClick={handleScheduleSubmit}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 'payment' && selectedService && (
          <div className="space-y-4">
            {/* Active Subscription Banner */}
            {activeSubscription && (
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{activeSubscription.plan?.displayName || 'Abonnement'}</h3>
                      <Badge className="bg-white/20 text-white text-xs">Actif</Badge>
                    </div>
                    <p className="text-sm text-white/80 mt-1">
                      {activeSubscription.remainingWashes} séance{activeSubscription.remainingWashes > 1 ? 's' : ''} restante{activeSubscription.remainingWashes > 1 ? 's' : ''}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setUseSubscription(!useSubscription)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          useSubscription ? 'bg-white' : 'bg-white/30'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                          useSubscription ? 'left-7 bg-purple-500' : 'left-1 bg-white'
                        }`} />
                      </button>
                      <span className="text-sm">
                        {useSubscription ? 'Utiliser mon abonnement' : 'Payer normalement'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-[#212121] mb-3">Récapitulatif</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{selectedService.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span>{isHomeService ? 'À domicile' : 'En station'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Adresse</span>
                  <span className="text-right max-w-[150px] truncate">{address}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Quand</span>
                  <span>{scheduledTime === 'now' ? 'Maintenant' : new Date(scheduledDate).toLocaleString('fr-FR')}</span>
                </div>
                <hr className="my-2" />
                
                {useSubscription && activeSubscription ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Prix de base</span>
                      <span className="line-through text-gray-400">{selectedService.price.toLocaleString()} XOF</span>
                    </div>
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Abonnement</span>
                      <span>1 séance déduite</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2">
                      <span>Total</span>
                      <span className="text-purple-600">GRATUIT</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Prix de base</span>
                      <span>{selectedService.price.toLocaleString()} XOF</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Réduction</span>
                        <span>-{appliedPromo.discountAmount.toLocaleString()} XOF</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2">
                      <span>Total</span>
                      <span className="text-[#FF9800]">{getFinalPrice().toLocaleString()} XOF</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Promo Code - only show if not using subscription */}
            {!useSubscription && (
              <div className="bg-white rounded-lg p-4">
                <Label className="font-medium mb-3 block">Code promo</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-700">{appliedPromo.code}</span>
                    </div>
                    <button onClick={handleRemovePromo} className="text-red-500 text-sm font-medium">
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Entrez votre code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="border-2 focus:border-[#FF9800] h-10"
                    />
                    <Button
                      variant="outline"
                      className="border-[#FF9800] text-[#FF9800]"
                      onClick={handleApplyPromo}
                      disabled={!promoCode || isValidatingPromo}
                    >
                      {isValidatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                    </Button>
                  </div>
                )}
                {promoError && <p className="text-sm text-red-500 mt-2">{promoError}</p>}
              </div>
            )}

            {/* Payment Method - only show if not using subscription */}
            {!useSubscription && (
              <div className="bg-white rounded-lg p-4">
                <Label className="font-medium mb-3 block">Mode de paiement</Label>
                <div className="space-y-3">
                {/* Wallet */}
                <button
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    paymentMethod === 'wallet' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                  } ${walletBalance < getFinalPrice() ? 'opacity-60' : ''}`}
                  onClick={() => walletBalance >= getFinalPrice() && setPaymentMethod('wallet')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FF9800] rounded-full flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="font-medium text-[#212121]">Portefeuille</span>
                        <p className="text-sm text-gray-500">Solde: {walletBalance.toLocaleString()} XOF</p>
                      </div>
                    </div>
                    {walletBalance >= getFinalPrice() ? (
                      <div className="w-5 h-5 border-2 border-[#FF9800] rounded-full flex items-center justify-center">
                        {paymentMethod === 'wallet' && <div className="w-3 h-3 bg-[#FF9800] rounded-full" />}
                      </div>
                    ) : (
                      <span className="text-xs text-red-500">Insuffisant</span>
                    )}
                  </div>
                </button>

                {/* Cash */}
                <button
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    paymentMethod === 'cash' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                  }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-10 h-10 p-2 bg-green-100 rounded-full text-green-600" />
                      <div>
                        <span className="font-medium text-[#212121]">Espèces</span>
                        <p className="text-sm text-gray-500">Payer au laveur</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 border-2 border-[#FF9800] rounded-full flex items-center justify-center">
                      {paymentMethod === 'cash' && <div className="w-3 h-3 bg-[#FF9800] rounded-full" />}
                    </div>
                  </div>
                </button>
              </div>
            </div>
            )}

            <Button 
              className="w-full h-14 bg-[#FF9800] hover:bg-[#F57C00] text-white text-lg rounded-xl font-semibold"
              onClick={handlePaymentSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : useSubscription && activeSubscription ? (
                'Confirmer avec mon abonnement'
              ) : (
                `Confirmer ${getFinalPrice().toLocaleString()} XOF`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
