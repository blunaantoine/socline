'use client';

import { useState, useEffect } from 'react';
import { useServicesStore, useOrdersStore, useAppStore, useAuthStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, MapPin, Clock, CreditCard, Wallet, 
  CheckCircle, Star, AlertCircle, Loader2,
  Zap, Droplets, Sparkles, Crown
} from 'lucide-react';
import type { Service, Order } from '@/types';

interface ClientOrderFlowProps {
  onBack: () => void;
  onOrderComplete?: () => void;
}

export function ClientOrderFlow({ onBack, onOrderComplete }: ClientOrderFlowProps) {
  const { services, selectedService, selectService, setServices } = useServicesStore();
  const { setCurrentOrder, addOrder } = useOrdersStore();
  const { userLocation } = useAppStore();
  const { user } = useAuthStore();
  const [step, setStep] = useState<'service' | 'location' | 'schedule' | 'payment'>('service');
  const [isHomeService, setIsHomeService] = useState(true);
  const [address, setAddress] = useState(userLocation?.address || '');
  const [scheduledTime, setScheduledTime] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'mobile_money' | 'cash' | 'card'>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [mobileProvider, setMobileProvider] = useState<'mixx' | 'tmoney'>('mixx');
  const [mobileNumber, setMobileNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // Fetch services on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        // First check if we need to seed the database
        const seedCheck = await fetch('/api/seed');
        const seedData = await seedCheck.json();
        
        if (!seedData.seeded || seedData.servicesCount === 0) {
          // Seed the database
          await fetch('/api/seed', { method: 'POST' });
        }

        // Fetch services
        const res = await fetch('/api/services');
        const data = await res.json();
        
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
        const data = await res.json();
        if (data.success && data.wallet) {
          setWalletBalance(data.wallet.balance);
        }
      } catch (error) {
        console.error('Error fetching wallet:', error);
      }
    };
    fetchWallet();
  }, [user?.id]);

  const handleServiceSelect = (service: Service) => {
    selectService(service);
    setStep('location');
  };

  const handleLocationSubmit = () => {
    if (!address) {
      return;
    }
    setStep('schedule');
  };

  const handleScheduleSubmit = () => {
    setStep('payment');
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
      
      const data = await res.json();
      
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
    const basePrice = selectedService.price;
    if (appliedPromo) {
      return Math.max(0, basePrice - appliedPromo.discountAmount);
    }
    return basePrice;
  };

  const handlePaymentSubmit = async () => {
    if (!selectedService) return;
    
    // Use real user ID or show error
    const clientId = user?.id;
    console.log('Creating order with clientId:', clientId, 'user:', user);
    
    if (!clientId) {
      alert('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    // Validate wallet payment
    const finalPrice = getFinalPrice();
    if (paymentMethod === 'wallet' && walletBalance < finalPrice) {
      alert('Solde insuffisant dans votre portefeuille.');
      return;
    }

    // Validate mobile money
    if (paymentMethod === 'mobile_money' && mobileNumber.length < 8) {
      alert('Veuillez entrer un numéro Mobile Money valide.');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create the order first
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          serviceId: selectedService.id,
          isHomeService,
          address,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          totalPrice: finalPrice,
          promoCode: appliedPromo?.code || null,
          discount: appliedPromo?.discountAmount || 0,
          scheduledAt: scheduledTime === 'later' ? scheduledDate : null,
        }),
      });

      const data = await res.json();
      console.log('Order response:', data);

      if (data.success && data.order) {
        // Process wallet payment if selected
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
          
          const walletData = await walletRes.json();
          if (!walletData.success) {
            alert('Erreur lors du paiement par portefeuille. La commande a été créée mais le paiement a échoué.');
          }
        }

        // Create payment record
        await fetch('/api/orders/' + data.order.id + '/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: clientId,
            amount: finalPrice,
            method: paymentMethod === 'wallet' ? 'WALLET' : paymentMethod === 'mobile_money' ? 'MOBILE_MONEY' : paymentMethod === 'card' ? 'CARD' : 'CASH',
            phoneNumber: paymentMethod === 'mobile_money' ? mobileNumber : undefined,
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
        
        // Redirect after successful order
        if (onOrderComplete) {
          onOrderComplete();
        }
      } else {
        // If user not found, force logout
        if (data.error?.includes('reconnecter')) {
          alert('Session expirée. Veuillez vous reconnecter.');
          window.location.reload();
          return;
        }
        alert(data.error || 'Erreur lors de la création de la commande');
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('Erreur de connexion. Réessayez.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingServices) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FF9800]" />
          <p className="mt-4 text-[#757575]">Chargement des services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-3 flex-shrink-0 sticky top-6 z-40">
        <div className="flex items-center gap-3">
          {step === 'service' ? (
            <button onClick={onBack} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5 text-[#212121]" />
            </button>
          ) : (
            <button 
              onClick={() => {
                if (step === 'location') setStep('service');
                else if (step === 'schedule') setStep('location');
                else if (step === 'payment') setStep('schedule');
              }}
              className="p-1 -ml-1"
            >
              <ArrowLeft className="w-5 h-5 text-[#212121]" />
            </button>
          )}
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

      {/* Progress Steps - Android Stepper Style */}
      <div className="bg-white px-4 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-center justify-between">
          {[
            { id: 'service', label: 'Service', step: 1 },
            { id: 'location', label: 'Adresse', step: 2 },
            { id: 'schedule', label: 'Planifier', step: 3 },
            { id: 'payment', label: 'Paiement', step: 4 },
          ].map((item, index) => {
            const isActive = step === item.id;
            const isPast = 
              (step === 'location' && index < 1) ||
              (step === 'schedule' && index < 2) ||
              (step === 'payment' && index < 3);
            
            return (
              <div key={item.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#FF9800] text-white shadow-lg shadow-[#FF9800]/30'
                        : isPast
                        ? 'bg-[#4CAF50] text-white'
                        : 'bg-[#E0E0E0] text-[#9E9E9E]'
                    }`}
                  >
                    {isPast && !isActive ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      item.step
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${
                    isActive ? 'text-[#FF9800]' : isPast ? 'text-[#4CAF50]' : 'text-[#9E9E9E]'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${
                    isPast ? 'bg-[#4CAF50]' : 'bg-[#E0E0E0]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 p-4">
        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-4 text-gray-500">Aucun service disponible</p>
                <p className="text-sm text-gray-400">Veuillez réessayer plus tard</p>
              </div>
            ) : (
              services.map((service) => (
                <Card 
                  key={service.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-[#FF9800]"
                  onClick={() => handleServiceSelect(service)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-[#FFF3E0] rounded-lg flex items-center justify-center">
                        {service.category === 'basic' && <Zap className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'standard' && <Droplets className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'premium' && <Sparkles className="w-7 h-7 text-[#FF9800]" />}
                        {service.category === 'deluxe' && <Crown className="w-7 h-7 text-[#FF9800]" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-[#212121]">{service.name}</h3>
                          <Badge variant="secondary" className="bg-[#FFF3E0] text-[#FF9800]">{service.duration} min</Badge>
                        </div>
                        <p className="text-sm text-[#757575] mt-1">{service.description}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xl font-bold text-[#FF9800]">
                            {service.price.toLocaleString()} F
                          </span>
                          <Button size="sm" className="bg-[#FF9800] hover:bg-[#F57C00]">Choisir</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Step 2: Location */}
        {step === 'location' && selectedService && (
          <div className="space-y-6">
            {/* Service Type Toggle */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-medium mb-3 block">Type de service</Label>
                <div className="flex gap-4">
                  <button
                    className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
                      isHomeService ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                    }`}
                    onClick={() => setIsHomeService(true)}
                  >
                    <MapPin className="w-6 h-6 mx-auto mb-2 text-[#FF9800]" />
                    <span className="font-medium">À domicile</span>
                    <p className="text-xs text-gray-500 mt-1">Le laveur vient chez vous</p>
                  </button>
                  <button
                    className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
                      !isHomeService ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                    }`}
                    onClick={() => setIsHomeService(false)}
                  >
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 text-[#FF9800]" />
                    <span className="font-medium">En station</span>
                    <p className="text-xs text-gray-500 mt-1">Vous allez à la station</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Address Input */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-medium mb-3 block">
                  {isHomeService ? 'Adresse de service' : 'Station de lavage'}
                </Label>
                {isHomeService ? (
                  <div className="space-y-3">
                    <Input
                      placeholder="Entrez votre adresse"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="border-2 focus:border-[#FF9800]"
                    />
                    <div className="flex items-center gap-2 text-sm text-[#FF9800] cursor-pointer">
                      <MapPin className="w-4 h-4" />
                      <span>Utiliser ma position actuelle</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { name: 'Auto Shine Lomé', address: 'Centre-ville, Lomé', distance: '1.2 km' },
                      { name: 'Car Wash Bè', address: 'Bè, Lomé', distance: '2.5 km' },
                    ].map((station, i) => (
                      <button
                        key={i}
                        className="w-full p-3 rounded-lg border text-left hover:bg-[#FFF8F0] hover:border-[#FF9800]"
                        onClick={() => setAddress(station.address)}
                      >
                        <div className="font-medium">{station.name}</div>
                        <div className="text-sm text-gray-500">{station.address}</div>
                        <div className="text-xs text-[#FF9800]">{station.distance}</div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-medium mb-3 block">Quand voulez-vous le lavage ?</Label>
                <RadioGroup value={scheduledTime} onValueChange={(v: any) => setScheduledTime(v)}>
                  <div className="space-y-3">
                    <div className={`p-4 rounded-lg border-2 cursor-pointer ${
                      scheduledTime === 'now' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                    }`} onClick={() => setScheduledTime('now')}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="now" id="now" className="text-[#FF9800]" />
                        <div>
                          <Label htmlFor="now" className="font-medium cursor-pointer">
                            Maintenant
                          </Label>
                          <p className="text-sm text-gray-500">
                            Un laveur sera disponible dans ~15 min
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border-2 cursor-pointer ${
                      scheduledTime === 'later' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200'
                    }`} onClick={() => setScheduledTime('later')}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="later" id="later" className="text-[#FF9800]" />
                        <div>
                          <Label htmlFor="later" className="font-medium cursor-pointer">
                            Planifier
                          </Label>
                          <p className="text-sm text-gray-500">
                            Choisissez une date et heure
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </RadioGroup>

                {scheduledTime === 'later' && (
                  <div className="mt-4 grid gap-3">
                    <Input
                      type="date"
                      value={scheduledDate.split('T')[0]}
                      onChange={(e) => setScheduledDate(e.target.value + 'T10:00:00')}
                      className="border-2 focus:border-[#FF9800]"
                    />
                    <Input
                      type="time"
                      onChange={(e) => {
                        const [date] = scheduledDate.split('T');
                        setScheduledDate(`${date}T${e.target.value}:00`);
                      }}
                      className="border-2 focus:border-[#FF9800]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleScheduleSubmit}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 'payment' && selectedService && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{selectedService.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span>{isHomeService ? 'À domicile' : 'En station'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Adresse</span>
                  <span className="text-right text-sm">{address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quand</span>
                  <span>{scheduledTime === 'now' ? 'Maintenant' : new Date(scheduledDate).toLocaleString('fr-FR')}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-gray-500">Prix de base</span>
                  <span>{selectedService.price.toLocaleString()} F</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-green-600">
                    <span>Réduction ({appliedPromo.discountType === 'PERCENTAGE' ? `${appliedPromo.discountValue}%` : `${appliedPromo.discountValue.toLocaleString()} F`})</span>
                    <span>-{appliedPromo.discountAmount.toLocaleString()} F</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#FF9800]">{getFinalPrice().toLocaleString()} F</span>
                </div>
              </CardContent>
            </Card>

            {/* Promo Code */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-medium mb-3 block">Code promo</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <span className="font-bold text-green-700">{appliedPromo.code}</span>
                        <p className="text-xs text-green-600">
                          -{appliedPromo.discountAmount.toLocaleString()} F de réduction
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemovePromo}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                                               placeholder="Entrez votre code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="border-2 focus:border-[#FF9800]"
                      />
                      <Button
                        variant="outline"
                        className="border-[#FF9800] text-[#FF9800]"
                        onClick={handleApplyPromo}
                        disabled={!promoCode || isValidatingPromo}
                      >
                        {isValidatingPromo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Appliquer'
                        )}
                      </Button>
                    </div>
                    {promoError && (
                      <p className="text-sm text-red-500">{promoError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <Label className="text-base font-medium">Mode de paiement</Label>
                
                {/* Wallet Option */}
                <div
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'wallet' ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200 hover:border-gray-300'
                  } ${walletBalance < getFinalPrice() ? 'opacity-60' : ''}`}
                  onClick={() => {
                    if (walletBalance >= getFinalPrice()) {
                      setPaymentMethod('wallet');
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#FF9800] to-[#F57C00] rounded-full flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <Label className="font-medium cursor-pointer text-[#212121]">
                          Portefeuille WashGo
                        </Label>
                        <p className="text-sm text-[#757575]">
                          Solde: {walletBalance.toLocaleString()} F
                        </p>
                      </div>
                    </div>
                    {walletBalance >= getFinalPrice() ? (
                      <div className="w-5 h-5 border-2 border-[#FF9800] rounded-full flex items-center justify-center">
                        {paymentMethod === 'wallet' && <div className="w-3 h-3 bg-[#FF9800] rounded-full" />}
                      </div>
                    ) : (
                      <span className="text-xs text-red-500 font-medium">Solde insuffisant</span>
                    )}
                  </div>
                </div>

                <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <div className="space-y-3">
                    {[
                      { id: 'cash', label: 'Espèces', icon: CreditCard, desc: 'Payer en espèces au laveur', color: '#4CAF50' },
                      { id: 'mobile_money', label: 'Mobile Money', icon: Wallet, desc: 'Mixx by Yas, T-Money', color: '#FF9800' },
                      { id: 'card', label: 'Carte bancaire', icon: CreditCard, desc: 'Visa, Mastercard', color: '#2196F3' },
                    ].map((method) => (
                      <div
                        key={method.id}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          paymentMethod === method.id ? 'border-[#FF9800] bg-[#FFF8F0]' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setPaymentMethod(method.id as any)}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={method.id} id={method.id} />
                          <method.icon className="w-5 h-5 text-[#757575]" />
                          <div>
                            <Label htmlFor={method.id} className="font-medium cursor-pointer text-[#212121]">
                              {method.label}
                            </Label>
                            <p className="text-sm text-[#757575]">{method.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                {/* Mobile Money Provider Selection */}
                {paymentMethod === 'mobile_money' && (
                  <div className="mt-4 pt-4 border-t border-[#F5F5F5] space-y-4">
                    <Label className="text-sm font-medium text-[#757575]">Choisissez votre opérateur</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setMobileProvider('mixx')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          mobileProvider === 'mixx' 
                            ? 'border-[#FF9800] bg-[#FFF8F0]' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-[#FFE0B2] rounded-full flex items-center justify-center">
                            <span className="text-lg font-bold text-[#FF9800]">M</span>
                          </div>
                          <span className="font-medium text-sm text-[#212121]">Mixx by Yas</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setMobileProvider('tmoney')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          mobileProvider === 'tmoney' 
                            ? 'border-[#FF9800] bg-[#FFF8F0]' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 bg-[#E3F2FD] rounded-full flex items-center justify-center">
                            <span className="text-lg font-bold text-[#2196F3]">T</span>
                          </div>
                          <span className="font-medium text-sm text-[#212121]">T-Money</span>
                        </div>
                      </button>
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#757575]">Numéro Mobile Money</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]">+228</span>
                        <Input
                          type="tel"
                          placeholder="90 12 34 56"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          className="pl-14 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full h-14 bg-[#FF9800] hover:bg-[#F57C00] text-white text-lg rounded-2xl font-semibold shadow-lg shadow-[#FF9800]/30"
              onClick={handlePaymentSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Traitement en cours...
                </>
              ) : (
                `Confirmer ${getFinalPrice().toLocaleString()} F`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
