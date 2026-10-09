'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Clock, Plus, 
  Loader2, CheckCircle, XCircle, ArrowLeft, Phone, PhoneCall,
  CreditCard, ChevronRight, Sparkles, RefreshCw, History,
  AlertCircle, Check
} from 'lucide-react';
import { HideableBalanceDark } from '@/components/ui/hideable-balance';
import { toast } from 'sonner';
import { parseJsonResponse } from '@/lib/json-helper';
import { onSoclineNotification } from '@/components/RealtimeNotifications';
import { BTN_PRIMARY_CLASSES, BTN_SECONDARY_CLASSES, CARD_CLASSES } from '@/lib/design-system';

interface WalletData {
  id: string;
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  isActive: boolean;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT' | 'REFUND' | 'BONUS';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description: string | null;
  paymentMethod?: string | null;
  ussdCode?: string | null;
  ussdConfirmedAt?: string | null;
  orderId: string | null;
  balanceAfter: number;
  createdAt: string;
}

interface Operator {
  id: string;
  name: string;
  displayName: string;
  ussdPattern: string;
  recipientNumber: string;
  color: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
}

const TRANSACTION_LABELS: Record<string, string> = {
  DEPOSIT: 'Rechargement',
  WITHDRAWAL: 'Retrait',
  PAYMENT: 'Paiement',
  REFUND: 'Remboursement',
  BONUS: 'Bonus',
};

const TRANSACTION_COLORS: Record<string, string> = {
  DEPOSIT: 'text-success',
  WITHDRAWAL: 'text-danger',
  PAYMENT: 'text-brand',
  REFUND: 'text-success',
  BONUS: 'text-plan-purple-icon',
};

const TRANSACTION_ICONS: Record<string, any> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  PAYMENT: CreditCard,
  REFUND: ArrowDownLeft,
  BONUS: Sparkles,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  COMPLETED: 'Complété',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

// Les dépôts PayDunya ne dépendent PAS d'une validation admin :
// le statut vient de PayDunya (webhook IPN + vérification automatique).
// Libellé volontairement court pour ne pas déborder des badges sur mobile.
const txStatusLabel = (tx: Transaction) =>
  tx.status === 'PENDING' && tx.paymentMethod === 'PayDunya'
    ? 'PayDunya en cours…'
    : STATUS_LABELS[tx.status] ?? tx.status;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-brand-soft text-brand-deep border-brand/20',
  COMPLETED: 'bg-success/10 text-success border-success/20',
  FAILED: 'bg-danger/10 text-danger border-danger/20',
  CANCELLED: 'bg-app text-soft border-line',
};

const AMOUNT_OPTIONS = [
  { value: 1000, label: '1 000 F' },
  { value: 2000, label: '2 000 F' },
  { value: 5000, label: '5 000 F' },
  { value: 10000, label: '10 000 F' },
  { value: 20000, label: '20 000 F' },
  { value: 50000, label: '50 000 F' },
];

type DepositStep = 'amount' | 'operator' | 'phone' | 'ussd' | 'confirm' | 'paydunya';

// Système de paiement actif (choisi par l'admin) — détermine le flux de dépôt
interface PaymentConfigData {
  provider: 'MIXX_USSD' | 'PAYDUNYA';
  paydunyaConfigured: boolean;
  paydunyaStoreName?: string;
}

interface DepositState {
  step: DepositStep;
  amount: number;
  operatorId: string;
  phoneNumber: string;
  transactionId: string;
  ussdCode: string;
  ussdLink: string;
  recipientNumber: string;
}

/** Ligne de transaction — utilisée par « Transactions récentes » et l'historique. */
function TxRow({
  tx,
  formatDate,
  formatDateFull,
  detailed,
}: {
  tx: Transaction;
  formatDate: (d: string) => string;
  formatDateFull: (d: string) => string;
  detailed?: boolean;
}) {
  const Icon = TRANSACTION_ICONS[tx.type] || CreditCard;
  const isCredit = tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS';
  return (
    <div className={`p-4 ${CARD_CLASSES}`}>
      <div className={detailed ? 'flex items-start gap-3' : 'flex items-center gap-3'}>
        <div
          className={`w-10 h-10 rounded-full grid place-items-center flex-shrink-0 ${
            isCredit ? 'bg-success/10' : 'bg-danger/10'
          }`}
        >
          <Icon className={`w-5 h-5 ${TRANSACTION_COLORS[tx.type]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body font-semibold text-ink">{TRANSACTION_LABELS[tx.type]}</p>
            <Badge variant="outline" className={`text-micro max-w-full rounded-pill ${STATUS_COLORS[tx.status]}`}>
              <span className="truncate">{txStatusLabel(tx)}</span>
            </Badge>
          </div>
          {detailed ? (
            <>
              <p className="text-detail text-soft mt-1">{formatDateFull(tx.createdAt)}</p>
              {tx.paymentMethod && <p className="text-detail text-soft mt-0.5">Via {tx.paymentMethod}</p>}
              {tx.description && <p className="text-detail text-soft mt-0.5">{tx.description}</p>}
              {tx.ussdConfirmedAt && (
                <p className="text-detail text-success mt-0.5">✓ Payé le {formatDate(tx.ussdConfirmedAt)}</p>
              )}
            </>
          ) : (
            <p className="text-detail text-soft truncate">
              {tx.description || formatDate(tx.createdAt)}
              {tx.paymentMethod ? ` · Via ${tx.paymentMethod}` : ''}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`font-bold text-body ${isCredit ? 'text-success' : 'text-danger'}`}>
            {isCredit ? '+' : '-'}{tx.amount.toLocaleString('fr-FR')} F
          </p>
          {tx.status === 'COMPLETED' && (
            <p className="text-micro text-soft">Solde : {tx.balanceAfter.toLocaleString('fr-FR')} F</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function WalletScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // NOTE UX : l'utilisateur ne voit plus ni le code USSD ni de bouton « Copier » —
  // le bouton « Payer » lance directement le composeur avec le code prérempli (tel:).
  
  const [deposit, setDeposit] = useState<DepositState>({
    step: 'amount',
    amount: 0,
    operatorId: '',
    phoneNumber: '',
    transactionId: '',
    ussdCode: '',
    ussdLink: '',
    recipientNumber: '',
  });

  // Fetch wallet data
  const fetchWallet = async (showRefreshLoader = false) => {
    if (!user?.id) return;

    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const res = await fetch(`/api/wallet?userId=${user.id}`);
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setWallet(data.wallet);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
      toast.error('Erreur lors du chargement du portefeuille');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch operators
  const fetchOperators = async () => {
    try {
      const res = await fetch('/api/operators?activeOnly=true');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setOperators(data.operators);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    }
  };

  // Fetch payment system config (admin's choice: Mixx USSD or PayDunya)
  const fetchPaymentConfig = async () => {
    try {
      const res = await fetch('/api/payment/config');
      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setPaymentConfig({
          provider: data.provider,
          paydunyaConfigured: Boolean(data.paydunyaConfigured),
          paydunyaStoreName: data.paydunyaStoreName,
        });
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchOperators();
    fetchPaymentConfig();
  }, [user?.id]);

  // Realtime refresh: when a payment notification arrives (deposit validated
  // or rejected by the admin), refresh the balance and history at once.
  useEffect(() => {
    const off = onSoclineNotification((payload) => {
      if (payload?.type === 'payment' || payload?.type === 'PAYMENT') {
        fetchWallet(true);
      }
    });
    return off;
  }, []);

  // Auto-poll the pending deposit while the USSD dialog is open: as soon as
  // the admin validates (COMPLETED) or rejects (FAILED) the transaction, the
  // dialog closes itself with the right toast and the wallet refreshes.
  useEffect(() => {
    if (!showDeposit || !deposit.transactionId) return;

    const checkDepositStatus = async () => {
      try {
        const res = await fetch(`/api/wallet?userId=${user?.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success) return;

        const tx = data.wallet?.transactions?.find(
          (t: Transaction) => t.id === deposit.transactionId
        );
        if (!tx) return;

        if (tx.status === 'COMPLETED') {
          toast.success(`Rechargement de ${deposit.amount.toLocaleString('fr-FR')} F validé ✅`);
          setShowDeposit(false);
          resetDeposit();
          fetchWallet(true);
        } else if (tx.status === 'FAILED') {
          toast.error('Votre rechargement a été rejeté. Contactez le support si vous avez payé.');
          setShowDeposit(false);
          resetDeposit();
          fetchWallet(true);
        }
      } catch {
        // Network hiccup — next tick retries.
      }
    };

    const interval = setInterval(checkDepositStatus, 8000);
    return () => clearInterval(interval);
  }, [showDeposit, deposit.transactionId, deposit.amount, user?.id]);

  // Système actif : le flux PayDunya ne s'affiche que si l'admin l'a choisi
  // ET l'a configuré — sinon on garde le flux USSD classique.
  const usePaydunyaFlow =
    paymentConfig?.provider === 'PAYDUNYA' && paymentConfig.paydunyaConfigured;

  // Poller global des dépôts PayDunya en attente : quand l'utilisateur revient
  // de la page de paiement PayDunya, dès que PayDunya confirme, le solde
  // s'actualise automatiquement (validation 100 % automatique).
  useEffect(() => {
    const pendingPaydunya = (wallet?.transactions ?? []).filter(
      (t: Transaction) => t.status === 'PENDING' && t.paymentMethod === 'PayDunya'
    );

    if (pendingPaydunya.length === 0) return;

    const checkStatuses = async () => {
      for (const tx of pendingPaydunya.slice(0, 3)) {
        try {
          const res = await fetch(`/api/payment/paydunya/status?transactionId=${tx.id}`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data?.status === 'COMPLETED') {
            toast.success(`Rechargement de ${tx.amount.toLocaleString('fr-FR')} F confirmé ✅`);
            fetchWallet(true);
            return;
          }
          if (data?.status === 'FAILED') {
            toast.error(
              data?.reason === 'timeout'
                ? "Rechargement expiré : paiement non confirmé dans le délai (15 min). Vous pouvez réessayer."
                : "Le paiement PayDunya n'a pas abouti. Vous pouvez réessayer."
            );
            fetchWallet(true);
            return;
          }
        } catch {
          // Network hiccup — next tick retries.
        }
      }
    };

    const interval = setInterval(checkStatuses, 6000);
    checkStatuses();
    return () => clearInterval(interval);
  }, [wallet?.transactions, user?.id]);

  // Get selected operator
  const selectedOperator = operators.find(o => o.id === deposit.operatorId);

  // Étapes du flux selon le système de paiement actif :
  //  - MIXX_USSD : montant → opérateur → téléphone → USSD → confirmation
  //  - PAYDUNYA  : montant → paiement en ligne (redirection checkout)
  const getFlowSteps = (): DepositStep[] =>
    usePaydunyaFlow
      ? ['amount', 'paydunya']
      : ['amount', 'operator', 'phone', 'ussd', 'confirm'];

  // Handle deposit flow
  const handleNextStep = () => {
    const steps = getFlowSteps();
    const currentIndex = steps.indexOf(deposit.step);
    
    if (currentIndex < steps.length - 1) {
      setDeposit(prev => ({ ...prev, step: steps[currentIndex + 1] }));
    }
  };

  const handlePrevStep = () => {
    const steps = getFlowSteps();
    const currentIndex = steps.indexOf(deposit.step);
    
    if (currentIndex > 0) {
      setDeposit(prev => ({ ...prev, step: steps[currentIndex - 1] }));
    }
  };

  const handleCreateTransaction = async () => {
    if (!user?.id || deposit.amount <= 0 || !deposit.operatorId || !deposit.phoneNumber) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: deposit.amount,
          phoneNumber: deposit.phoneNumber,
          operatorId: deposit.operatorId,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        setDeposit(prev => ({
          ...prev,
          transactionId: data.transaction.id,
          ussdCode: data.transaction.ussdCode,
          ussdLink: data.transaction.ussdLink,
          recipientNumber: data.transaction.recipientNumber,
        }));
        handleNextStep();
      } else {
        toast.error(data.error || 'Erreur lors de la création de la transaction');
      }
    } catch (error) {
      toast.error('Erreur lors de la création de la transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLaunchUssd = () => {
    if (deposit.ussdLink) {
      // Ouvre le composeur du téléphone avec le code USSD prérempli —
      // l'utilisateur n'a plus rien à recopier, il valide simplement l'appel.
      window.location.href = deposit.ussdLink;
    }
  };

  // Créer la facture PayDunya puis rediriger vers la page de paiement en ligne
  const handlePaydunyaPayment = async () => {
    if (!user?.id || deposit.amount <= 0) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/paydunya/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: deposit.amount }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success && data.checkoutUrl) {
        toast.info('Redirection vers la page de paiement PayDunya…');
        // Redirection vers le checkout PayDunya — à son retour, le poller
        // détecte automatiquement la confirmation et crédite le solde.
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Erreur lors de la création du paiement PayDunya');
      }
    } catch (error) {
      toast.error('Erreur lors de la création du paiement PayDunya');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!deposit.transactionId || !user?.id) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: deposit.transactionId,
          userId: user.id,
        }),
      });

      const data = await parseJsonResponse<any>(res);
      if (!data) return;

      if (data.success) {
        toast.success('Confirmation enregistrée ! Un administrateur validera votre paiement.');
        setShowDeposit(false);
        resetDeposit();
        fetchWallet(true);
      } else {
        toast.error(data.error || 'Erreur lors de la confirmation');
      }
    } catch (error) {
      toast.error('Erreur lors de la confirmation');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDeposit = () => {
    setDeposit({
      step: 'amount',
      amount: 0,
      operatorId: '',
      phoneNumber: '',
      transactionId: '',
      ussdCode: '',
      ussdLink: '',
      recipientNumber: '',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Dernière recharge réussie (affichée sur la carte solde)
  const lastDeposit = (wallet?.transactions ?? []).find(
    (t) => t.type === 'DEPOSIT' && t.status === 'COMPLETED'
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4 bg-app">
        <div className="h-7 w-40 rounded bg-line animate-pulse" />
        <div className="h-[170px] rounded-card bg-ink/90 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-btn bg-line animate-pulse" />
          <div className="h-12 rounded-btn bg-line animate-pulse" />
        </div>
        <div className="h-[76px] rounded-card bg-surface border border-line animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header clair : actualisation (le titre est dans l'en-tête global de l'app) */}
      <div className="bg-app px-4 pt-1 pb-2 flex items-center justify-end flex-shrink-0">
        <button
          onClick={() => fetchWallet(true)}
          disabled={isRefreshing}
          aria-label="Actualiser le solde"
          className="w-9 h-9 rounded-btn bg-surface border border-line grid place-items-center active:scale-95 transition-transform"
        >
          <RefreshCw className={`w-[18px] h-[18px] text-brand ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-4">
        {/* Carte solde navy */}
        <div className="bg-gradient-to-br from-ink to-ink-2 rounded-card p-5 text-white relative overflow-hidden">
          {/* Rond orange décoratif (identité, même style que le hero promo) */}
          <div className="absolute -right-10 -top-10 w-[150px] h-[150px] rounded-full bg-brand/20" aria-hidden="true" />
          <div className="relative">
            <p className="text-detail text-white/60">Solde disponible</p>
            <div className="mt-1.5 mb-4">
              <HideableBalanceDark
                balance={wallet?.balance || 0}
                currency="F"
                size="xl"
                storageKey="hide-client-wallet-balance"
              />
            </div>

            <div className="flex justify-between border-t border-white/15 pt-3">
              <div>
                <p className="text-micro text-white/60">Total rechargé</p>
                <p className="text-body font-bold mt-0.5">
                  {(wallet?.totalDeposited || 0).toLocaleString('fr-FR')} F
                </p>
              </div>
              <div className="text-right">
                <p className="text-micro text-white/60">Dernière recharge</p>
                <p className="text-body font-bold mt-0.5">
                  {lastDeposit ? formatDate(lastDeposit.createdAt) : '–'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions : Recharger + Historique */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => {
              resetDeposit();
              setShowDeposit(true);
            }}
            className={`h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Recharger
          </Button>
          <Button
            onClick={() => setShowHistory(true)}
            className="h-12 bg-surface hover:bg-app text-ink border border-line rounded-btn font-bold"
          >
            <History className="w-4 h-4 mr-2" />
            Historique
          </Button>
        </div>

        {/* Transactions récentes */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-section text-ink">Transactions récentes</h2>
          <button
            onClick={() => setShowHistory(true)}
            className="text-detail text-brand font-semibold active:opacity-70 transition-opacity"
          >
            Voir tout
          </button>
        </div>

        {!wallet?.transactions || wallet.transactions.length === 0 ? (
          <div className={`py-8 px-4 ${CARD_CLASSES} flex flex-col items-center text-center`}>
            <div className="w-[84px] h-[84px] rounded-[26px] bg-brand-soft grid place-items-center mb-3">
              <Wallet className="w-11 h-11 text-brand" strokeWidth={1.6} />
            </div>
            <p className="text-body font-bold text-ink">Aucune transaction</p>
            <p className="text-detail text-soft mt-1 mb-4">Rechargez pour payer vos lavages en un geste.</p>
            <button
              onClick={() => {
                resetDeposit();
                setShowDeposit(true);
              }}
              className={`px-4 py-2.5 ${BTN_SECONDARY_CLASSES} text-detail font-bold active:scale-95 transition-transform min-h-[44px]`}
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              Recharger
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {wallet.transactions.slice(0, 5).map((tx) => (
              <TxRow key={tx.id} tx={tx} formatDate={formatDate} formatDateFull={formatFullDate} />
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal with USSD Flow */}
      <Dialog open={showDeposit} onOpenChange={(open) => {
        setShowDeposit(open);
        if (!open) resetDeposit();
      }}>
        <DialogContent className="max-w-md p-0">
          <div className="p-4 border-b border-line">
            <DialogHeader>
              <DialogTitle className="text-title text-ink flex items-center gap-2">
                {deposit.step === 'paydunya' ? (
                  <>
                    <CreditCard className="w-5 h-5 text-brand" />
                    Paiement en ligne
                  </>
                ) : deposit.step === 'ussd' || deposit.step === 'confirm' ? (
                  <>
                    <Phone className="w-5 h-5 text-brand" />
                    Paiement USSD
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-brand" />
                    Recharger le portefeuille
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-4">
            {/* Step indicator — adapté au flux actif */}
            {usePaydunyaFlow ? (
              <div className="flex items-center justify-center gap-2 mb-4">
                {['amount', 'paydunya'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-6 h-6 rounded-full grid place-items-center text-micro font-semibold ${
                      ['amount', 'paydunya'].indexOf(deposit.step) >= index
                        ? 'bg-brand text-white'
                        : 'bg-line text-soft'
                    }`}>
                      {index + 1}
                    </div>
                    {index < 1 && (
                      <div className={`w-6 h-0.5 ${
                        ['amount', 'paydunya'].indexOf(deposit.step) > index
                          ? 'bg-brand'
                          : 'bg-line'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-4">
                {['amount', 'operator', 'phone', 'ussd'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-6 h-6 rounded-full grid place-items-center text-micro font-semibold ${
                      ['amount', 'operator', 'phone', 'ussd', 'confirm'].indexOf(deposit.step) >= index
                        ? 'bg-brand text-white'
                        : 'bg-line text-soft'
                    }`}>
                      {index + 1}
                    </div>
                    {index < 3 && (
                      <div className={`w-6 h-0.5 ${
                        ['amount', 'operator', 'phone', 'ussd', 'confirm'].indexOf(deposit.step) > index
                          ? 'bg-brand'
                          : 'bg-line'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step: Amount */}
            {deposit.step === 'amount' && (
              <div className="space-y-4">
                <p className="text-body text-soft">Choisissez un montant à recharger</p>
                <div className="grid grid-cols-3 gap-2">
                  {AMOUNT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDeposit(prev => ({ ...prev, amount: opt.value }))}
                      className={`p-3 rounded-btn text-body font-semibold transition-all ${
                        deposit.amount === opt.value
                          ? 'bg-brand text-white'
                          : 'bg-app text-soft hover:bg-line'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="Ou entrez un montant personnalisé"
                  value={deposit.amount || ''}
                  onChange={(e) => setDeposit(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                  className="h-12 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30"
                />
              </div>
            )}

            {/* Step: Operator */}
            {deposit.step === 'operator' && (
              <div className="space-y-3">
                <p className="text-body text-soft">Sélectionnez votre opérateur Mobile Money</p>
                {operators.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-soft mx-auto mb-2" />
                    <p className="text-body text-soft">Aucun opérateur disponible</p>
                  </div>
                ) : (
                  operators.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setDeposit(prev => ({ ...prev, operatorId: op.id }))}
                      className={`w-full p-4 rounded-btn flex items-center gap-3 transition-all ${
                        deposit.operatorId === op.id
                          ? 'border-2 border-brand bg-brand-wash'
                          : 'border border-line bg-surface'
                      }`}
                    >
                      <div 
                        className="w-12 h-12 rounded-full grid place-items-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: op.color }}
                      >
                        {op.name.charAt(0)}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-body font-semibold text-ink">{op.displayName}</p>
                        <p className="text-detail text-soft">
                          Min : {op.minAmount.toLocaleString('fr-FR')} F · Max : {op.maxAmount.toLocaleString('fr-FR')} F
                        </p>
                      </div>
                      {deposit.operatorId === op.id && (
                        <Check className="w-5 h-5 text-brand flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step: Phone */}
            {deposit.step === 'phone' && (
              <div className="space-y-4">
                <p className="text-body text-soft">
                  Entrez votre numéro {selectedOperator?.displayName}
                </p>
                <div className="bg-brand-wash rounded-btn p-4 mb-1">
                  <div className="flex justify-between items-center">
                    <span className="text-body text-soft">Montant à recharger</span>
                    <span className="font-extrabold text-brand text-lg">
                      {deposit.amount.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-body text-soft mb-2 block">Numéro de téléphone</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-soft font-semibold">+228</span>
                    <Input
                      type="tel"
                      placeholder="90 12 34 56"
                      value={deposit.phoneNumber}
                      onChange={(e) => setDeposit(prev => ({ 
                        ...prev, 
                        phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 8) 
                      }))}
                      className="pl-14 h-12 rounded-btn border-line focus-visible:border-brand focus-visible:ring-brand/30 text-lg"
                    />
                  </div>
                  <p className="text-detail text-soft mt-2">
                    Ce numéro sera utilisé pour vérifier votre paiement
                  </p>
                </div>
              </div>
            )}

            {/* Step: USSD */}
            {deposit.step === 'ussd' && (
              <div className="space-y-3">
                {/* Instructions */}
                <div className="bg-brand-soft border border-brand/20 rounded-btn p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-brand-deep flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-brand-deep text-body">Instructions</p>
                      <p className="text-detail text-brand-deep/80 mt-1">
                        1. Appuyez sur « Payer » : le code s'affiche dans votre composeur<br/>
                        2. Validez l'appel et entrez votre PIN Mobile Money<br/>
                        3. Revenez ici et appuyez « J'ai payé »
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bouton Payer — lance automatiquement le code USSD dans le composeur */}
                <Button
                  onClick={handleLaunchUssd}
                  disabled={!deposit.ussdLink}
                  className={`w-full h-14 ${BTN_PRIMARY_CLASSES} font-bold text-base`}
                >
                  <PhoneCall className="w-5 h-5 mr-2" />
                  Payer {deposit.amount.toLocaleString('fr-FR')} F
                </Button>
                <p className="text-detail text-center text-soft px-2">
                  Le code de paiement est composé automatiquement : vous n'avez rien à recopier.
                </p>
              </div>
            )}

            {/* Step: PayDunya — paiement en ligne (redirection checkout) */}
            {deposit.step === 'paydunya' && (
              <div className="space-y-3">
                <div className="bg-brand-wash rounded-btn p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-body text-soft">Montant à recharger</span>
                    <span className="font-extrabold text-brand text-lg">
                      {deposit.amount.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-app border border-line rounded-btn p-3">
                  <div className="flex gap-2">
                    <CreditCard className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-ink text-body">Paiement sécurisé PayDunya</p>
                      <p className="text-detail text-soft mt-1">
                        1. Appuyez sur « Payer » : vous êtes redirigé vers la page de paiement PayDunya<br/>
                        2. Choisissez votre moyen de paiement (T-Money, Moov Money, Wave…)<br/>
                        3. Votre solde est crédité automatiquement dès la confirmation
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bouton Payer — redirige vers la page de paiement PayDunya */}
                <Button
                  onClick={handlePaydunyaPayment}
                  disabled={isProcessing}
                  className={`w-full h-14 ${BTN_PRIMARY_CLASSES} font-bold text-base`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-5 h-5 mr-2" />
                  )}
                  Payer {deposit.amount.toLocaleString('fr-FR')} F
                </Button>
                <p className="text-detail text-center text-soft px-2">
                  Aucun code à recopier : tout se passe en ligne, votre solde est crédité automatiquement.
                </p>
              </div>
            )}

            {/* Step: Confirm */}
            {deposit.step === 'confirm' && (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <div className="w-14 h-14 bg-brand-soft rounded-full grid place-items-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-brand" />
                  </div>
                  <p className="font-semibold text-ink">Avez-vous validé le paiement ?</p>
                  <p className="text-detail text-soft mt-1.5">
                    Confirmez si vous avez entré votre code PIN
                  </p>
                </div>

                <div className="bg-app rounded-btn p-3 space-y-2">
                  <div className="flex justify-between text-body">
                    <span className="text-soft">Montant</span>
                    <span className="font-semibold text-ink">{deposit.amount.toLocaleString('fr-FR')} F</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <span className="text-soft">Opérateur</span>
                    <span className="font-semibold text-ink">{selectedOperator?.name}</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <span className="text-soft">Numéro</span>
                    <span className="font-semibold text-ink">+228 {deposit.phoneNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-line space-y-2">
            {/* Step-specific actions */}
            {deposit.step === 'amount' && (
              <Button
                onClick={handleNextStep}
                disabled={deposit.amount <= 0}
                className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
              >
                Continuer
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {deposit.step === 'operator' && (
              <>
                <Button
                  onClick={handleNextStep}
                  disabled={!deposit.operatorId}
                  className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
                >
                  Continuer
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={handlePrevStep} className="w-full h-11 rounded-btn">
                  Retour
                </Button>
              </>
            )}

            {deposit.step === 'phone' && (
              <>
                <Button
                  onClick={handleCreateTransaction}
                  disabled={isProcessing || deposit.phoneNumber.length < 8}
                  className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <>
                      Générer le code USSD
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handlePrevStep} className="w-full h-11 rounded-btn">
                  Retour
                </Button>
              </>
            )}

            {deposit.step === 'paydunya' && (
              <Button variant="outline" onClick={handlePrevStep} className="w-full h-11 rounded-btn">
                Retour
              </Button>
            )}

            {deposit.step === 'ussd' && (
              <>
                <Button
                  onClick={handleNextStep}
                  className={`w-full h-12 ${BTN_PRIMARY_CLASSES} font-bold`}
                >
                  J'ai payé
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => setDeposit(prev => ({ ...prev, step: 'phone' }))} className="w-full h-11 rounded-btn">
                  Modifier le numéro
                </Button>
              </>
            )}

            {deposit.step === 'confirm' && (
              <>
                <Button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="w-full h-12 bg-success hover:bg-success/90 text-white rounded-btn font-bold"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirmer le paiement
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDeposit(prev => ({ ...prev, step: 'ussd' }))} 
                  className="w-full h-11 rounded-btn"
                >
                  Non, revenir au code USSD
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] p-0 flex flex-col">
          <div className="p-4 border-b border-line flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-title text-ink flex items-center gap-2">
                <History className="w-5 h-5 text-brand" />
                Historique des transactions
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!wallet?.transactions || wallet.transactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-soft mx-auto mb-3" />
                <p className="text-body text-soft">Aucune transaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallet.transactions.map((tx) => (
                  <TxRow key={tx.id} tx={tx} formatDate={formatDate} formatDateFull={formatFullDate} detailed />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-line flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowHistory(false)}
              className="w-full h-11 rounded-btn"
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
