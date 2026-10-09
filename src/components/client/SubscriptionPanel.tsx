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
  Crown, Check, Zap, Gift, Clock,
  CreditCard, ChevronRight, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { parseJsonResponse } from '@/lib/json-helper';
import { BTN_PRIMARY_CLASSES, planPriorityImage } from '@/lib/design-system';
import { CoverageBadge, CoverageDetails } from '@/components/shared/ServiceCoverage';

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
    coverage?: string | null;
    category?: string | null;
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

/**
 * Image du plan (design system) : une voiture DIFFÉRENTE par niveau —
 * Essentiel = citadine, Confort = berline à la mousse, Premium = SUV au
 * jet avec laveur, Prestige = berline noire de luxe.
 * Remplace les icônes couronne / goutte / éclair.
 */
function planCarFor(priority: number) {
  return planPriorityImage(priority);
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

      const plansData = await parseJsonResponse<any>(plansRes);
      const subsData = await parseJsonResponse<any>(subsRes);
      if (!plansData || !subsData) return;

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

      const data = await parseJsonResponse<any>(res);
      if (!data) return;
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

  // Vignette voiture du plan (liste, carte active, modale)
  const renderPlanIcon = (priority: number, size = 'w-[52px] h-[52px] rounded-[17px]') => {
    return (
      <div className={`${size} overflow-hidden flex-shrink-0`}>
        <img
          src={planCarFor(priority)}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-7 w-44 rounded bg-line animate-pulse" />
        <div className="h-[96px] rounded-card bg-surface border border-line animate-pulse" />
        <div className="h-[96px] rounded-card bg-surface border border-line animate-pulse" />
        <div className="h-[96px] rounded-card bg-surface border border-line animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header : actualisation à droite (le titre « Abonnements » est dans l'en-tête global) */}
      <div className="flex items-center justify-end">
        <button
          onClick={fetchData}
          disabled={isLoading}
          aria-label="Actualiser les abonnements"
          className="w-9 h-9 rounded-btn bg-surface border border-line grid place-items-center active:scale-95 transition-transform disabled:opacity-60"
        >
          <RefreshCw className={`w-[18px] h-[18px] text-brand ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-body text-soft">Lavez plus, payez moins.</p>

      {/* Rappel de la différence entre les deux types de prestation */}
      <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface p-3">
        <img
          src="/voitures/services/interieur.png"
          alt=""
          aria-hidden="true"
          className="w-8 h-8 rounded-[10px] object-cover flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-detail font-semibold text-ink">Quelle différence&nbsp;?</p>
          <p className="text-detail text-soft leading-relaxed">
            <span className="font-semibold text-brand">Complet</span> = extérieur + intérieur ·{' '}
            <span className="font-semibold text-[#2E7D32]">Extérieur</span> = carrosserie uniquement.
          </p>
        </div>
      </div>

      {/* Abonnement actif */}
      {activeSubscription && (
        <Card className={`border border-line shadow-card rounded-card overflow-hidden`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {renderPlanIcon(activeSubscription.plan.priority)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-body font-bold text-ink">{activeSubscription.plan.displayName}</h3>
                    <span className="text-micro bg-success/10 text-success border border-success/20 rounded-pill px-2 py-0.5">Actif</span>
                    <CoverageBadge service={activeSubscription.plan.service} short />
                  </div>
                  <p className="text-detail text-soft mt-0.5">
                    Expire le {formatDate(activeSubscription.endDate)}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-title font-extrabold text-brand">
                  {activeSubscription.remainingWashes}
                </div>
                <div className="text-micro text-soft">lavages restants</div>
              </div>
            </div>

            {/* Progression */}
            <div className="mt-4">
              <div className="flex justify-between text-micro text-soft mb-1">
                <span>{activeSubscription.usedWashes} utilisés</span>
                <span>{activeSubscription.totalWashes} total</span>
              </div>
              <div className="h-2 bg-app rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${(activeSubscription.usedWashes / activeSubscription.totalWashes) * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-line">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-brand">
                  <Clock className="w-4 h-4" />
                  <span className="font-bold text-body">{getDaysRemaining(activeSubscription.endDate)}</span>
                </div>
                <div className="text-micro text-soft">jours restants</div>
              </div>
              {activeSubscription.freeOptionsTotal > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-plan-purple-icon">
                    <Gift className="w-4 h-4" />
                    <span className="font-bold text-body">
                      {activeSubscription.freeOptionsTotal - activeSubscription.freeOptionsUsed}
                    </span>
                  </div>
                  <div className="text-micro text-soft">options gratuites</div>
                </div>
              )}
              {activeSubscription.bonusWashEarned && (
                <div className="text-center">
                  <Badge className="bg-star-soft text-star border-0">
                    <Gift className="w-3 h-3 mr-1" />
                    Bonus gagné !
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formules disponibles */}
      {!activeSubscription && (
        <div className="space-y-3">
          {plans.map((plan, index) => {
            const isPopular = plans.length >= 2 && index === 1;
            return (
              <Card 
                key={plan.id} 
                className={`relative rounded-card shadow-card cursor-pointer transition-all ${
                  isPopular ? 'border-[1.5px] border-brand' : 'border border-line'
                }`}
                onClick={() => {
                  setSelectedPlan(plan);
                  setShowSubscribeModal(true);
                }}
              >
                {isPopular && (
                  <span className="absolute -top-2.5 right-4 bg-brand text-white text-micro font-bold rounded-pill px-2.5 py-0.5">
                    Populaire
                  </span>
                )}
                <CardContent className="p-3.5 flex items-center gap-3.5">
                  {renderPlanIcon(plan.priority)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-body font-bold text-ink">{plan.displayName}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <CoverageBadge service={plan.service} short />
                      <span className="text-detail text-soft">{plan.washCount} lavages / mois</span>
                    </div>
                    {plan.features[0] && (
                      <div className="flex items-center gap-1.5 text-detail mt-1.5 text-soft">
                        <Check className="w-[15px] h-[15px] text-success flex-shrink-0" strokeWidth={2.4} />
                        <span className="truncate">{plan.features[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-body font-extrabold text-ink">
                      {plan.price.toLocaleString('fr-FR')} F
                    </div>
                    <div className="text-micro text-soft">/mois</div>
                  </div>
                  <ChevronRight className="w-[18px] h-[18px] text-soft/60 flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Historique des abonnements */}
      {userSubscriptions.length > 1 && (
        <Card className="border border-line shadow-card rounded-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-section text-ink">Historique des abonnements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-line">
              {userSubscriptions.filter(s => s.id !== activeSubscription?.id).slice(0, 3).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderPlanIcon(sub.plan.priority, 'w-9 h-9 rounded-[11px]')}
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink">{sub.plan.name}</p>
                      <p className="text-detail text-soft">
                        {formatDate(sub.startDate)} - {formatDate(sub.endDate)}
                      </p>
                    </div>
                  </div>
                  <Badge className={sub.isExpired
                    ? 'bg-app text-soft border border-line rounded-pill'
                    : 'bg-success/10 text-success border border-success/20 rounded-pill'}>
                    {sub.isExpired ? 'Expiré' : 'Actif'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modale de souscription */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              {selectedPlan && (
                <>
                  {renderPlanIcon(selectedPlan.priority, 'w-8 h-8 rounded-[9px]')}
                  {selectedPlan.displayName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-1">
              <p className="text-body text-soft">{selectedPlan.description}</p>

              {/* Ce que comprend la prestation : extérieur toujours inclus,
                  intérieur inclus ou non selon la couverture (Complet vs Extérieur) */}
              <CoverageDetails service={selectedPlan.service} />

              {/* Durée */}
              <div className="space-y-2">
                <label className="text-body font-bold text-ink">Durée</label>
                <Select value={selectedDuration} onValueChange={(v: any) => setSelectedDuration(v)}>
                  <SelectTrigger className="h-12 rounded-btn border-line">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">
                      <div className="flex justify-between w-full">
                        <span>1 mois</span>
                        <span className="ml-4 font-semibold">{selectedPlan.price.toLocaleString('fr-FR')} F</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="QUARTERLY">
                      <div className="flex justify-between w-full">
                        <span>3 mois</span>
                        <div className="ml-4 flex items-center gap-2">
                          <Badge className="bg-success/10 text-success border border-success/20 text-micro">-{getDiscount(selectedPlan, 'QUARTERLY')}%</Badge>
                          <span className="font-semibold">{getPrice(selectedPlan, 'QUARTERLY').toLocaleString('fr-FR')} F</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="YEARLY">
                      <div className="flex justify-between w-full">
                        <span>1 an</span>
                        <div className="ml-4 flex items-center gap-2">
                          <Badge className="bg-success/10 text-success border border-success/20 text-micro">-{getDiscount(selectedPlan, 'YEARLY')}%</Badge>
                          <span className="font-semibold">{getPrice(selectedPlan, 'YEARLY').toLocaleString('fr-FR')} F</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Résumé */}
              <div className="bg-brand-soft rounded-btn p-4 space-y-2">
                <div className="flex justify-between text-body">
                  <span className="text-soft">Lavages inclus</span>
                  <span className="font-semibold text-ink">{getTotalWashes(selectedPlan, selectedDuration)}</span>
                </div>
                <div className="flex justify-between text-body">
                  <span className="text-soft">Durée</span>
                  <span className="font-semibold text-ink">{getDurationLabel(selectedDuration)}</span>
                </div>
                <div className="flex justify-between text-body font-bold pt-2 border-t border-brand/20">
                  <span className="text-ink">Total</span>
                  <span className="text-brand">{getPrice(selectedPlan, selectedDuration).toLocaleString('fr-FR')} F</span>
                </div>
              </div>

              {/* Solde */}
              <div className="flex items-center justify-between text-body">
                <span className="text-soft">Votre solde</span>
                <span className={`font-semibold ${walletBalance >= getPrice(selectedPlan, selectedDuration) ? 'text-success' : 'text-danger'}`}>
                  {walletBalance.toLocaleString('fr-FR')} F
                </span>
              </div>

              {/* Avantages */}
              <div className="space-y-2">
                <label className="text-body font-bold text-ink">Avantages inclus</label>
                <div className="space-y-1.5">
                  {selectedPlan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-body text-ink">
                      <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2.4} />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {selectedPlan.includesExpress && (
                    <div className="flex items-center gap-2 text-body text-ink">
                      <Zap className="w-4 h-4 text-star flex-shrink-0" />
                      <span>Service express inclus</span>
                    </div>
                  )}
                  {selectedPlan.includesVip && (
                    <div className="flex items-center gap-2 text-body text-ink">
                      <Crown className="w-4 h-4 text-star flex-shrink-0" />
                      <span>Accès VIP</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscribeModal(false)} disabled={isSubscribing} className="h-11 rounded-btn">
              Annuler
            </Button>
            <Button 
              className={`h-11 ${BTN_PRIMARY_CLASSES} font-bold`}
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
