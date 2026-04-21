'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
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
  Loader2, CheckCircle, XCircle, ArrowLeft, Phone,
  CreditCard, ChevronRight, Sparkles, RefreshCw, History,
  Copy, ExternalLink, AlertCircle, Check
} from 'lucide-react';
import { toast } from 'sonner';

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
  DEPOSIT: 'text-green-600',
  WITHDRAWAL: 'text-red-600',
  PAYMENT: 'text-orange-600',
  REFUND: 'text-blue-600',
  BONUS: 'text-purple-600',
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  FAILED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const AMOUNT_OPTIONS = [
  { value: 1000, label: '1 000 F' },
  { value: 2000, label: '2 000 F' },
  { value: 5000, label: '5 000 F' },
  { value: 10000, label: '10 000 F' },
  { value: 20000, label: '20 000 F' },
  { value: 50000, label: '50 000 F' },
];

type DepositStep = 'amount' | 'operator' | 'phone' | 'ussd' | 'confirm';

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

export function WalletScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
      const data = await res.json();

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
      const data = await res.json();

      if (data.success) {
        setOperators(data.operators);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchOperators();
  }, [user?.id]);

  // Get selected operator
  const selectedOperator = operators.find(o => o.id === deposit.operatorId);

  // Handle deposit flow
  const handleNextStep = () => {
    const steps: DepositStep[] = ['amount', 'operator', 'phone', 'ussd', 'confirm'];
    const currentIndex = steps.indexOf(deposit.step);
    
    if (currentIndex < steps.length - 1) {
      setDeposit(prev => ({ ...prev, step: steps[currentIndex + 1] }));
    }
  };

  const handlePrevStep = () => {
    const steps: DepositStep[] = ['amount', 'operator', 'phone', 'ussd', 'confirm'];
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

      const data = await res.json();

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
      window.location.href = deposit.ussdLink;
    }
  };

  const handleCopyUssd = async () => {
    if (deposit.ussdCode) {
      await navigator.clipboard.writeText(deposit.ussdCode);
      setCopied(true);
      toast.success('Code USSD copié !');
      setTimeout(() => setCopied(false), 2000);
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

      const data = await res.json();

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF9800]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-4 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold">Mon Portefeuille</h1>
          </div>
          <button 
            onClick={() => fetchWallet(true)} 
            disabled={isRefreshing}
            className="p-2 hover:bg-white/20 rounded-lg transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
          <p className="text-white/80 text-sm mb-1">Solde disponible</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {wallet?.balance?.toLocaleString() || 0}
            </span>
            <span className="text-lg">F CFA</span>
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="flex-1">
              <p className="text-xs text-white/60">Total rechargé</p>
              <p className="font-semibold">{wallet?.totalDeposited?.toLocaleString() || 0} F</p>
            </div>
            <div className="flex-1">
              <button 
                onClick={() => setShowHistory(true)}
                className="w-full text-left hover:bg-white/10 rounded-lg p-1 -m-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/60">Historique</p>
                    <p className="font-semibold flex items-center gap-1">
                      <History className="w-3 h-3" />
                      Voir tout
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => {
              resetDeposit();
              setShowDeposit(true);
            }}
            className="flex-1 bg-white text-[#FF9800] hover:bg-white/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Recharger
          </Button>
        </div>
      </div>

      {/* Transactions */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#212121]">Transactions récentes</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowHistory(true)}
            className="text-[#FF9800]"
          >
            Voir tout
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {!wallet?.transactions || wallet.transactions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-[#BDBDBD] mx-auto mb-3" />
            <p className="text-[#757575]">Aucune transaction</p>
            <p className="text-sm text-[#9E9E9E] mt-1">Rechargez votre portefeuille pour commencer</p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallet.transactions.slice(0, 5).map((tx) => {
              const Icon = TRANSACTION_ICONS[tx.type] || CreditCard;
              return (
                <Card key={tx.id} className="shadow-sm border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}>
                        <Icon className={`w-5 h-5 ${TRANSACTION_COLORS[tx.type]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#212121]">
                            {TRANSACTION_LABELS[tx.type]}
                          </p>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[tx.status]}`}>
                            {STATUS_LABELS[tx.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#757575] truncate">
                          {tx.description || formatDate(tx.createdAt)}
                        </p>
                        {tx.paymentMethod && (
                          <p className="text-xs text-[#9E9E9E]">
                            Via {tx.paymentMethod}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${
                          tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS' ? '+' : '-'}
                          {tx.amount.toLocaleString()} F
                        </p>
                        {tx.status === 'COMPLETED' && (
                          <p className="text-xs text-[#9E9E9E]">
                            Solde: {tx.balanceAfter.toLocaleString()} F
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit Modal with USSD Flow */}
      <Dialog open={showDeposit} onOpenChange={(open) => {
        setShowDeposit(open);
        if (!open) resetDeposit();
      }}>
        <DialogContent className="max-w-md p-0">
          <div className="p-4 border-b border-[#E0E0E0]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#212121] flex items-center gap-2">
                {deposit.step === 'ussd' || deposit.step === 'confirm' ? (
                  <>
                    <Phone className="w-5 h-5 text-[#FF9800]" />
                    Paiement USSD
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-[#FF9800]" />
                    Recharger le portefeuille
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-4">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {['amount', 'operator', 'phone', 'ussd'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    ['amount', 'operator', 'phone', 'ussd', 'confirm'].indexOf(deposit.step) >= index
                      ? 'bg-[#FF9800] text-white'
                      : 'bg-[#E0E0E0] text-[#757575]'
                  }`}>
                    {index + 1}
                  </div>
                  {index < 3 && (
                    <div className={`w-6 h-0.5 ${
                      ['amount', 'operator', 'phone', 'ussd', 'confirm'].indexOf(deposit.step) > index
                        ? 'bg-[#FF9800]'
                        : 'bg-[#E0E0E0]'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step: Amount */}
            {deposit.step === 'amount' && (
              <div className="space-y-4">
                <p className="text-sm text-[#757575]">Choisissez un montant à recharger</p>
                <div className="grid grid-cols-3 gap-2">
                  {AMOUNT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDeposit(prev => ({ ...prev, amount: opt.value }))}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${
                        deposit.amount === opt.value
                          ? 'bg-[#FF9800] text-white'
                          : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#E0E0E0]'
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
                />
              </div>
            )}

            {/* Step: Operator */}
            {deposit.step === 'operator' && (
              <div className="space-y-3">
                <p className="text-sm text-[#757575]">Sélectionnez votre opérateur Mobile Money</p>
                {operators.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-[#BDBDBD] mx-auto mb-2" />
                    <p className="text-[#757575]">Aucun opérateur disponible</p>
                  </div>
                ) : (
                  operators.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setDeposit(prev => ({ ...prev, operatorId: op.id }))}
                      className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                        deposit.operatorId === op.id
                          ? 'ring-2 ring-[#FF9800] bg-[#FFF8F0]'
                          : 'bg-[#F5F5F5] hover:bg-[#E0E0E0]'
                      }`}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: op.color }}
                      >
                        {op.name.charAt(0)}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold text-[#212121]">{op.displayName}</p>
                        <p className="text-xs text-[#757575]">
                          Min: {op.minAmount.toLocaleString()} F | Max: {op.maxAmount.toLocaleString()} F
                        </p>
                      </div>
                      {deposit.operatorId === op.id && (
                        <Check className="w-5 h-5 text-[#FF9800]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step: Phone */}
            {deposit.step === 'phone' && (
              <div className="space-y-4">
                <p className="text-sm text-[#757575]">
                  Entrez votre numéro {selectedOperator?.displayName}
                </p>
                <div className="bg-[#FFF8F0] rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#757575]">Montant à recharger</span>
                    <span className="font-bold text-[#FF9800] text-xl">
                      {deposit.amount.toLocaleString()} F
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#757575] mb-2 block">Numéro de téléphone</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575] font-medium">+228</span>
                    <Input
                      type="tel"
                      placeholder="90 12 34 56"
                      value={deposit.phoneNumber}
                      onChange={(e) => setDeposit(prev => ({ 
                        ...prev, 
                        phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 8) 
                      }))}
                      className="pl-14 h-12 text-lg"
                    />
                  </div>
                  <p className="text-xs text-[#9E9E9E] mt-2">
                    Ce numéro sera utilisé pour vérifier votre paiement
                  </p>
                </div>
              </div>
            )}

            {/* Step: USSD */}
            {deposit.step === 'ussd' && (
              <div className="space-y-3">
                {/* Instructions */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 text-sm">Instructions</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        1. Lancez le code USSD<br/>
                        2. Entrez votre code PIN<br/>
                        3. Revenez et cliquez "J'ai payé"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Code USSD */}
                <div className="bg-[#212121] rounded-xl p-4 text-center">
                  <p className="text-white/60 text-xs mb-1">Code USSD</p>
                  <p className="text-white text-xl font-mono font-bold tracking-wide break-all">
                    {deposit.ussdCode}
                  </p>
                </div>

                {/* Boutons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyUssd}
                    className="h-11"
                  >
                    {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </Button>
                  <Button
                    onClick={handleLaunchUssd}
                    className="h-11 bg-[#FF9800] hover:bg-[#F57C00]"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Lancer
                  </Button>
                </div>

                {/* Info destinataire */}
                <div className="bg-[#F5F5F5] rounded-lg p-2.5 text-center">
                  <p className="text-xs text-[#757575]">
                    Destinataire: <span className="font-mono font-bold text-[#212121]">{deposit.recipientNumber}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step: Confirm */}
            {deposit.step === 'confirm' && (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <div className="w-14 h-14 bg-[#FFF8F0] rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-[#FF9800]" />
                  </div>
                  <p className="font-semibold text-[#212121]">Avez-vous validé le paiement ?</p>
                  <p className="text-xs text-[#757575] mt-1.5">
                    Confirmez si vous avez entré votre code PIN
                  </p>
                </div>

                <div className="bg-[#F5F5F5] rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#757575]">Montant</span>
                    <span className="font-semibold">{deposit.amount.toLocaleString()} F</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#757575]">Opérateur</span>
                    <span className="font-semibold">{selectedOperator?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#757575]">Numéro</span>
                    <span className="font-semibold">+228 {deposit.phoneNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-[#E0E0E0] space-y-2">
            {/* Step-specific actions */}
            {deposit.step === 'amount' && (
              <Button
                onClick={handleNextStep}
                disabled={deposit.amount <= 0}
                className="w-full bg-[#FF9800] hover:bg-[#F57C00] h-12"
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
                  className="w-full bg-[#FF9800] hover:bg-[#F57C00] h-12"
                >
                  Continuer
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={handlePrevStep} className="w-full">
                  Retour
                </Button>
              </>
            )}

            {deposit.step === 'phone' && (
              <>
                <Button
                  onClick={handleCreateTransaction}
                  disabled={isProcessing || deposit.phoneNumber.length < 8}
                  className="w-full bg-[#FF9800] hover:bg-[#F57C00] h-12"
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
                <Button variant="outline" onClick={handlePrevStep} className="w-full">
                  Retour
                </Button>
              </>
            )}

            {deposit.step === 'ussd' && (
              <>
                <Button
                  onClick={handleNextStep}
                  className="w-full bg-[#FF9800] hover:bg-[#F57C00] h-12"
                >
                  J'ai payé
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => setDeposit(prev => ({ ...prev, step: 'phone' }))} className="w-full">
                  Modifier le numéro
                </Button>
              </>
            )}

            {deposit.step === 'confirm' && (
              <>
                <Button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 h-12"
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
                  className="w-full"
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
          <div className="p-4 border-b border-[#E0E0E0] flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#212121] flex items-center gap-2">
                <History className="w-5 h-5 text-[#FF9800]" />
                Historique des transactions
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!wallet?.transactions || wallet.transactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-[#BDBDBD] mx-auto mb-3" />
                <p className="text-[#757575]">Aucune transaction</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallet.transactions.map((tx) => {
                  const Icon = TRANSACTION_ICONS[tx.type] || CreditCard;
                  return (
                    <Card key={tx.id} className="shadow-sm border-0">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}>
                            <Icon className={`w-5 h-5 ${TRANSACTION_COLORS[tx.type]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-[#212121]">
                                {TRANSACTION_LABELS[tx.type]}
                              </p>
                              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[tx.status]}`}>
                                {STATUS_LABELS[tx.status]}
                              </Badge>
                            </div>
                            <p className="text-xs text-[#757575] mt-1">
                              {formatFullDate(tx.createdAt)}
                            </p>
                            {tx.paymentMethod && (
                              <p className="text-xs text-[#9E9E9E] mt-1">
                                Via {tx.paymentMethod}
                              </p>
                            )}
                            {tx.description && (
                              <p className="text-xs text-[#757575] mt-1">
                                {tx.description}
                              </p>
                            )}
                            {tx.ussdConfirmedAt && (
                              <p className="text-xs text-green-600 mt-1">
                                ✓ Payé le {formatDate(tx.ussdConfirmedAt)}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-lg ${
                              tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}>
                              {tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.type === 'BONUS' ? '+' : '-'}
                              {tx.amount.toLocaleString()} F
                            </p>
                            {tx.status === 'COMPLETED' && (
                              <p className="text-xs text-[#9E9E9E]">
                                Solde: {tx.balanceAfter.toLocaleString()} F
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#E0E0E0] flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowHistory(false)}
              className="w-full"
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
