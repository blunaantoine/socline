'use client';

// AdminSupportTickets — gestion des demandes de support remontées par
// l'assistant IA « Soco ». Liste les tickets (invités + comptes), permet
// de changer leur statut et de joindre l'utilisateur (appel / WhatsApp).

import { useState, useEffect, useCallback } from 'react';
import {
  Headphones, RefreshCw, Loader2, Phone, MessageSquare,
  CheckCircle, Clock, AlertCircle, ChevronDown,
} from 'lucide-react';

interface SupportTicket {
  id: string;
  userId: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  subject: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; phone: string; role: string } | null;
}

const STATUS_META: Record<string, { label: string; classes: string; icon: typeof Clock }> = {
  OPEN: { label: 'Ouvert', classes: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  IN_PROGRESS: { label: 'En cours', classes: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  RESOLVED: { label: 'Résolu', classes: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AdminSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/support-tickets?status=${statusFilter}&limit=100`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.tickets) {
        setTickets(payload.tickets);
        setOpenCount(payload.openCount ?? 0);
      }
    } catch {
      // silencieux — le bouton Actualiser permet de retenter
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtres + compteur */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                statusFilter === s
                  ? 'bg-[#FF9800] text-white border-[#FF9800]'
                  : 'bg-white text-[#616161] border-[#E0E0E0] hover:border-[#FF9800]'
              }`}
            >
              {s === 'ALL' ? 'Tous' : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
              {openCount} ouvert{openCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={fetchTickets}
            className="p-2 rounded-full bg-white border border-[#E0E0E0] hover:border-[#FF9800] transition-all active:scale-95"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 text-[#616161] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Liste */}
      {isLoading && tickets.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF9800]" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-10 text-center">
          <Headphones className="w-10 h-10 text-[#BDBDBD] mx-auto mb-3" />
          <p className="text-[#616161] text-sm">Aucune demande de support pour le moment.</p>
          <p className="text-[#9E9E9E] text-xs mt-1">
            Les demandes envoyées via l&apos;assistant Soco apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const meta = STATUS_META[ticket.status] ?? STATUS_META.OPEN;
            const StatusIcon = meta.icon;
            const displayName = ticket.user?.name || ticket.name || 'Invité';
            const displayPhone = ticket.user?.phone || ticket.phone || '—';
            const isExpanded = expandedId === ticket.id;

            return (
              <div key={ticket.id} className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
                {/* En-tête du ticket */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FF9800]/10 grid place-items-center flex-shrink-0">
                    <Headphones className="w-5 h-5 text-[#FF9800]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#212121] text-sm truncate">{displayName}</span>
                      <span className="text-xs text-[#9E9E9E]">
                        {ticket.role === 'GUEST' ? '· invité' : `· ${ticket.role.toLowerCase()}`}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.classes}`}>
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#424242] mt-1 line-clamp-2">{ticket.subject}</p>
                    <p className="text-xs text-[#9E9E9E] mt-0.5">
                      {displayPhone} · {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#9E9E9E] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Détail déplié */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[#F0F0F0] pt-3">
                    <div className="bg-[#FAFAFA] rounded-lg p-3">
                      <p className="text-xs font-semibold text-[#616161] mb-1.5">Conversation avec Soco</p>
                      <p className="text-sm text-[#424242] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                        {ticket.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#9E9E9E]">Changer le statut :</span>
                      {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(ticket.id, s)}
                          disabled={updatingId === ticket.id || ticket.status === s}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 disabled:opacity-50 ${
                            ticket.status === s
                              ? STATUS_META[s].classes
                              : 'bg-white text-[#616161] border-[#E0E0E0] hover:border-[#FF9800]'
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                      {updatingId === ticket.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-[#FF9800]" />
                      )}
                    </div>

                    {displayPhone !== '—' && (
                      <div className="flex gap-2">
                        <a
                          href={`tel:+228${displayPhone}`}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-[#E0E0E0] rounded-lg py-2 text-xs font-semibold text-[#424242] hover:border-[#FF9800] transition-all active:scale-95"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Appeler
                        </a>
                        <a
                          href={`https://wa.me/${displayPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Bonjour ${displayName}, l'équipe Socline vous contacte au sujet de votre demande.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] rounded-lg py-2 text-xs font-semibold text-white active:scale-95 transition-transform"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
