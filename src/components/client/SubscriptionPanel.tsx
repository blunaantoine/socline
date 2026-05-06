'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Crown, Check, Sparkles, Star, Zap, Gift, Clock,
  Calendar, CreditCard, ChevronRight, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  quarterlyPrice: number | null;
  yearlyPrice: number | null;
  washCount: number;
  priority: number;
  bonusWashes: number;
  freeOptions: number;
  includesExpress: boolean;
  includesVip: boolean;
  features: string[];
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
}

interface UserSubscription {
  id: string;
  planId: string;
  plan: SubscriptionPlan;
  duration: string;
  paidAmount: number;
  totalWashes: number;
  usedWashes: number;
  remainingWashes: number;
  freeOptionsUsed: number;
  freeOptionsTotal: number;
  bonusWashEarned: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isExpired: boolean;
  autoRenew: boolean;
}

interface SubscriptionPanelProps {
  userId: string;
  walletBalance: number;
}

export function SubscriptionPanel({ userId, walletBalance }: SubscriptionPanelProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch plans and user subscriptions
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, subsRes] = await Promise.all([
        fetch('/api/subscriptions/plans?activeOnly=true'),
        fetch(`/api/subscriptions/user?userId=${userId}&includeHistory=true`),
      ]);

      const plansData = await plansRes.json();
      const subsData = await subsRes.json();

      if (plansData.success) {
        setPlans(plansData.plans);
      }

      if (subsData.success) {
        setUserSubscriptions(subsData.subscriptions);
        const active = subsData.subscriptions.find((s: UserSubscription) => s.isActive && !s.isExpired);
        setActiveSubscription(active || null);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get price for selected duration
  const getPrice = (plan: SubscriptionPlan, duration: string) => {
    switch (duration) {
      case 'QUARTERLY':
        return plan.quarterlyPrice || plan.price * 3 * 0.9;
      case 'YEARLY':
        return plan.yearlyPrice || plan.price * 12 * 0.8;
      default:
        return plan.price;
    }
  };

  // Get total washes for duration
  const getTotalWashes = (plan: SubscriptionPlan, duration: string) => {
    switch (duration) {
      case 'QUARTERLY':
        return plan.washCount * 3;
      case 'YEARLY':
        return plan.washCount * 12;
      default:
        return plan.washCount;
    }
  };

  // Get duration label
  const getDurationLabel = (duration: string) => {
    switch (duration) {
      case 'QUARTERLY':
        return '3 mois';
      case 'YEARLY':
        return '1 an';
      default:
        return '1 mois';
    }
  };

  // Get discount percentage
  const getDiscount = (plan: SubscriptionPlan, duration: string) => {
    const basePrice = plan.price * (duration === 'QUARTERLY' ? 3 : 12);
    const actualPrice = getPrice(plan, duration);
    return Math.round((1 - actualPrice / basePrice) * 100);
  };

  // Subscribe to plan
  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    const price = getPrice(selectedPlan, selectedDuration);

    if (walletBalance < price) {
      toast.error('Solde insuffisant. Rechargez votre wallet.');
      return;
    }

    setIsSubscribing(true);
    try {
      const res = await fetch('/api/subscriptions/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          planId: selectedPlan.id,
          duration: selectedDuration,
          paymentMethod: 'WALLET',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Abonnement activé avec succès !');
        setShowSubscribeModal(false);
        setSelectedPlan(null);
        fetchData();
      } else {
        toast.error(data.error || 'Erreur lors de la souscription');
      }
    } catch (error) {
      toast.error('Erreur lors de la souscription');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Get plan icon
  const getPlanIcon = (priority: number) => {
    switch (priority) {
      case 3:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 1:
        return <Star className="w-5 h-5 text-blue-500" />;
      default:
        return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get plan color
  const getPlanColor = (priority: number) => {
    switch (priority) {
      case 3:
        return 'from-yellow-400 to-orange-500';
      case 2:
        return 'from-purple-400 to-purple-600';
      case 1:
        return 'from-blue-400 to-blue-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 text-[#FF9800] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-[#212121]">Abonnements</h2>
        <button onClick={fetchData} disabled={isLoading} className="text-[#FF9800]">
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Active Subscription */}
      {activeSubscription && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className={`h-2 bg-gradient-to-r ${getPlanColor(activeSubscription.plan.priority)}`} />
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getPlanColor(activeSubscription.plan.priority)} flex items-center justify-center text-white`}>
                  {getPlanIcon(activeSubscription.plan.priority)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#212121]">{activeSubscription.plan.displayName}</h3>
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  </div>
                  <p className="text-xs text-[#757575] mt-1">
                    Expire le {formatDate(activeSubscription.endDate)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#FF9800]">
                  {activeSubscription.remainingWashes}
                </div>
                <div className="text-xs text-[#757575]">lavages restants</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#757575] mb-1">
                <span>{activeSubscription.usedWashes} utilisés</span>
                <span>{activeSubscription.totalWashes} total</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${getPlanColor(activeSubscription.plan.priority)} transition-all`}
                  style={{ width: `${(activeSubscription.usedWashes / activeSubscription.totalWashes) * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#F5F5F5]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#FF9800]">
                  <Clock className="w-4 h-4" />
                  <span className="font-bold">{getDaysRemaining(activeSubscription.endDate)}</span>
                </div>
                <div className="text-xs text-[#757575]">jours restants</div>
              </div>
              {activeSubscription.freeOptionsTotal > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-purple-500">
                    <Gift className="w-4 h-4" />
                    <span className="font-bold">
                      {activeSubscription.freeOptionsTotal - activeSubscription.freeOptionsUsed}
                    </span>
                  </div>
                  <div className="text-xs text-[#757575]">options gratuites</div>
                </div>
              )}
              {activeSubscription.bonusWashEarned && (
                <div className="text-center">
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <Gift className="w-3 h-3 mr-1" />
                    Bonus gagné !
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      {!activeSubscription && (
        <>
          <p className="text-sm text-[#757575]">
            Choisissez un abonnement pour profiter de lavages à prix réduit !
          </p>

          <div className="space-y-3">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`border-0 shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md`}
                onClick={() => {
                  setSelectedPlan(plan);
                  setShowSubscribeModal(true);
                }}
              >
                <div className={`h-1 bg-gradient-to-r ${getPlanColor(plan.priority)}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getPlanColor(plan.priority)} flex items-center justify-center text-white`}>
                        {getPlanIcon(plan.priority)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#212121]">{plan.displayName}</h3>
                        <p className="text-xs text-[#757575]">{plan.washCount} lavages/mois</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-[#FF9800]">
                        {plan.price.toLocaleString()} XOF
                      </div>
                      <div className="text-xs text-[#757575]">/mois</div>
                    </div>
                  </div>

                  {/* Features preview */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {plan.features.slice(0, 2).map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {plan.features.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{plan.features.length - 2}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end mt-2">
                    <ChevronRight className="w-5 h-5 text-[#9E9E9E]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Subscription History */}
      {userSubscriptions.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historique des abonnements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#F5F5F5]">
              {userSubscriptions.filter(s => s.id !== activeSubscription?.id).slice(0, 3).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    {getPlanIcon(sub.plan.priority)}
                    <div>
                      <p className="text-sm font-medium">{sub.plan.name}</p>
                      <p className="text-xs text-[#757575]">
                        {formatDate(sub.startDate)} - {formatDate(sub.endDate)}
                      </p>
                    </div>
                  </div>
                  <Badge className={sub.isExpired ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}>
                    {sub.isExpired ? 'Expiré' : 'Actif'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscribe Modal */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlan && (
                <>
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getPlanColor(selectedPlan.priority)} flex items-center justify-center text-white`}>
                    {getPlanIcon(selectedPlan.priority)}
                  </div>
                  {selectedPlan.displayName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-[#757575]">{selectedPlan.description}</p>

              {/* Duration Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée</label>
                <Select value={selectedDuration} onValueChange={(v: any) => setSelectedDuration(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">
                      <div className="flex justify-between w-full">
                        <span>1 mois</span>
                        <span className="ml-4 font-medium">{selectedPlan.price.toLocaleString()} XOF</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="QUARTERLY">
                      <div className="flex justify-between w-full">
                        <span>3 mois</span>
                        <div className="ml-4 flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">-{getDiscount(selectedPlan, 'QUARTERLY')}%</Badge>
                          <span className="font-medium">{getPrice(selectedPlan, 'QUARTERLY').toLocaleString()} XOF</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="YEARLY">
                      <div className="flex justify-between w-full">
                        <span>1 an</span>
                        <div className="ml-4 flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">-{getDiscount(selectedPlan, 'YEARLY')}%</Badge>
                          <span className="font-medium">{getPrice(selectedPlan, 'YEARLY').toLocaleString()} XOF</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div className="bg-[#FFF3E0] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#757575]">Lavages inclus</span>
                  <span className="font-medium">{getTotalWashes(selectedPlan, selectedDuration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#757575]">Durée</span>
                  <span className="font-medium">{getDurationLabel(selectedDuration)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#FFE0B2]">
                  <span>Total</span>
                  <span className="text-[#FF9800]">{getPrice(selectedPlan, selectedDuration).toLocaleString()} XOF</span>
                </div>
              </div>

              {/* Wallet balance */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#757575]">Votre solde</span>
                <span className={`font-medium ${walletBalance >= getPrice(selectedPlan, selectedDuration) ? 'text-green-600' : 'text-red-500'}`}>
                  {walletBalance.toLocaleString()} XOF
                </span>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Avantages inclus</label>
                <div className="space-y-1">
                  {selectedPlan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {selectedPlan.includesExpress && (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span>Service express inclus</span>
                    </div>
                  )}
                  {selectedPlan.includesVip && (
                    <div className="flex items-center gap-2 text-sm">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span>Accès VIP</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscribeModal(false)} disabled={isSubscribing}>
              Annuler
            </Button>
            <Button 
              className="bg-[#FF9800] hover:bg-[#F57C00]"
              onClick={handleSubscribe}
              disabled={isSubscribing || !selectedPlan || (selectedPlan && walletBalance < getPrice(selectedPlan, selectedDuration))}
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Souscription...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Souscrire
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
