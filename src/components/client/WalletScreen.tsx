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
  CreditCard, ChevronRight, Sparkles, RefreshCw, History
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
  orderId: string | null;
  balanceAfter: number;
  createdAt: string;
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

export function WalletScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mixx' | 'flooz'>('mixx');
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    fetchWallet();
  }, [user?.id]);

  const handleDeposit = async () => {
    if (!user?.id || depositAmount <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: depositAmount,
          phoneNumber,
          paymentMethod: paymentMethod === 'mixx' ? 'Mixx by Yas' : 'Flooz',
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Demande de rechargement envoyée ! En attente de validation.');
        setShowDeposit(false);
        setDepositAmount(0);
        setPhoneNumber('');
        // Refresh wallet to show the pending transaction
        fetchWallet(true);
      } else {
        toast.error(data.error || 'Erreur lors du rechargement');
      }
    } catch (error) {
      toast.error('Erreur lors du rechargement');
    } finally {
      setIsProcessing(false);
    }
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
            onClick={() => setShowDeposit(true)}
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

      {/* Deposit Modal */}
      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent className="max-w-md p-0">
          <div className="p-4 border-b border-[#E0E0E0]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#212121]">
                Recharger le portefeuille
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-4 space-y-4">
            {/* Amount Selection */}
            <div>
              <label className="text-sm text-[#757575] mb-2 block">Montant</label>
              <div className="grid grid-cols-3 gap-2">
                {AMOUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDepositAmount(opt.value)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all ${
                      depositAmount === opt.value
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
                placeholder="Ou entrez un montant"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(parseInt(e.target.value) || 0)}
                className="mt-2"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-sm text-[#757575] mb-2 block">Méthode de paiement</label>
              <div className="space-y-2">
                <button
                  onClick={() => setPaymentMethod('mixx')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                    paymentMethod === 'mixx'
                      ? 'bg-[#FF9800] text-white'
                      : 'bg-[#F5F5F5] text-[#212121]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    paymentMethod === 'mixx' ? 'bg-white/20' : 'bg-white'
                  }`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Mixx by Yas</p>
                    <p className={`text-xs ${paymentMethod === 'mixx' ? 'text-white/80' : 'text-[#757575]'}`}>
                      Togo Telecom
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('flooz')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                    paymentMethod === 'flooz'
                      ? 'bg-[#FF9800] text-white'
                      : 'bg-[#F5F5F5] text-[#212121]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    paymentMethod === 'flooz' ? 'bg-white/20' : 'bg-white'
                  }`}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Flooz</p>
                    <p className={`text-xs ${paymentMethod === 'flooz' ? 'text-white/80' : 'text-[#757575]'}`}>
                      Moov Africa
                    </p>
                  </div>
                </button>


              </div>
            </div>

            {/* Phone Number */}
            {(paymentMethod === 'mixx' || paymentMethod === 'flooz') && (
              <div>
                <label className="text-sm text-[#757575] mb-2 block">Numéro de téléphone</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757575]">+228</span>
                  <Input
                    type="tel"
                    placeholder="90 12 34 56"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="pl-14"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#FFF8F0] rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-[#757575]">Montant à recharger</span>
                <span className="font-bold text-[#FF9800] text-lg">
                  {depositAmount.toLocaleString()} F
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-[#E0E0E0] space-y-2">
            <Button
              onClick={handleDeposit}
              disabled={isProcessing || depositAmount <= 0}
              className="w-full bg-[#FF9800] hover:bg-[#F57C00] h-12"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2" />
              )}
              Confirmer le rechargement
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeposit(false)}
              className="w-full"
            >
              Annuler
            </Button>
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
