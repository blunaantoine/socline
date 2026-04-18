'use client';

import { useState } from 'react';
import { useServicesStore, useOrdersStore, useAppStore } from '@/store';
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
}

export function ClientOrderFlow({ onBack }: ClientOrderFlowProps) {
  const { services, selectedService, selectService } = useServicesStore();
  const { setCurrentOrder, addOrder } = useOrdersStore();
  const { userLocation } = useAppStore();
  const [step, setStep] = useState<'service' | 'location' | 'schedule' | 'payment'>('service');
  const [isHomeService, setIsHomeService] = useState(true);
  const [address, setAddress] = useState(userLocation?.address || '');
  const [scheduledTime, setScheduledTime] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'cash' | 'card'>('cash');
  const [mobileProvider, setMobileProvider] = useState<'mixx' | 'tmoney'>('mixx');
  const [mobileNumber, setMobileNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handlePaymentSubmit = async () => {
    if (!selectedService) return;
    
    setIsProcessing(true);
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'demo-client',
          serviceId: selectedService.id,
          isHomeService,
          address,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          totalPrice: selectedService.price,
          scheduledAt: scheduledTime === 'later' ? scheduledDate : null,
        }),
      });

      const data = await res.json();

      if (data.success && data.order) {
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
          discount: 0,
          totalPrice: data.order.totalPrice,
          commission: data.order.commission,
          status: data.order.status,
          scheduledAt: data.order.scheduledAt,
          createdAt: data.order.createdAt,
          updatedAt: data.order.updatedAt,
        };

        setCurrentOrder(order);
        addOrder(order);
      } else {
        alert(data.error || 'Erreur lors de la création de la commande');
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('Erreur de connexion. Réessayez.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-16 z-30">
        <div className="flex items-center gap-3">
          {step !== 'service' && (
            <button onClick={() => {
              if (step === 'location') setStep('service');
              else if (step === 'schedule') setStep('location');
              else if (step === 'payment') setStep('schedule');
            }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-semibold">
              {step === 'service' && 'Choisir un service'}
              {step === 'location' && 'Adresse de service'}
              {step === 'schedule' && 'Planification'}
              {step === 'payment' && 'Paiement'}
            </h1>
            <p className="text-sm text-gray-500">
              Étape {step === 'service' ? 1 : step === 'location' ? 2 : step === 'schedule' ? 3 : 4} sur 4
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white px-4 pb-4">
        <div className="h-1 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-green-500 rounded-full transition-all duration-300"
            style={{ 
              width: step === 'service' ? '25%' : step === 'location' ? '50%' : step === 'schedule' ? '75%' : '100%' 
            }}
          />
        </div>
      </div>

      <div className="p-4">
        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            {services.map((service) => (
              <Card 
                key={service.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleServiceSelect(service)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                      {service.category === 'basic' && <Zap className="w-7 h-7 text-emerald-600" />}
                      {service.category === 'standard' && <Droplets className="w-7 h-7 text-emerald-600" />}
                      {service.category === 'premium' && <Sparkles className="w-7 h-7 text-emerald-600" />}
                      {service.category === 'deluxe' && <Crown className="w-7 h-7 text-emerald-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{service.name}</h3>
                        <Badge variant="secondary">{service.duration} min</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xl font-bold text-emerald-600">
                          {service.price.toLocaleString()} FCFA
                        </span>
                        <Button size="sm">Choisir</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                      isHomeService ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setIsHomeService(true)}
                  >
                    <MapPin className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                    <span className="font-medium">À domicile</span>
                    <p className="text-xs text-gray-500 mt-1">Le laveur vient chez vous</p>
                  </button>
                  <button
                    className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
                      !isHomeService ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setIsHomeService(false)}
                  >
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 text-blue-600" />
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
                    />
                    <div className="flex items-center gap-2 text-sm text-blue-600 cursor-pointer">
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
                        className="w-full p-3 rounded-lg border text-left hover:bg-gray-50"
                        onClick={() => setAddress(station.address)}
                      >
                        <div className="font-medium">{station.name}</div>
                        <div className="text-sm text-gray-500">{station.address}</div>
                        <div className="text-xs text-blue-600">{station.distance}</div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
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
                      scheduledTime === 'now' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    }`} onClick={() => setScheduledTime('now')}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="now" id="now" />
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
                      scheduledTime === 'later' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                    }`} onClick={() => setScheduledTime('later')}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="later" id="later" />
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
                    />
                    <Input
                      type="time"
                      onChange={(e) => {
                        const [date] = scheduledDate.split('T');
                        setScheduledDate(`${date}T${e.target.value}:00`);
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
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
                  <span>{selectedService.price.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-blue-600">{selectedService.price.toLocaleString()} FCFA</span>
                </div>
              </CardContent>
            </Card>

            {/* Promo Code */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-base font-medium mb-3 block">Code promo</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Entrez votre code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  />
                  <Button variant="outline">Appliquer</Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <Label className="text-base font-medium">Mode de paiement</Label>
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
                `Confirmer ${selectedService.price.toLocaleString()} F`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
