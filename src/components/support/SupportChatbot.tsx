'use client';

// Soco — assistant support IA de Socline.
//
// Bulle flottante affichée UNIQUEMENT sur l'onglet « Profil » (client et
// laveur) — le composant est monté conditionnellement par ClientApp et
// WasherApp. Le panneau de chat appelle
// POST /api/support/chat : le backend injecte la base de connaissances live
// (formules, prix, abonnements, promos) + le contexte réel du compte
// (solde, commande en cours, abonnement) puis répond via le LLM.
// Si l'utilisateur veut un humain, l'API crée un ticket de support et le
// panneau affiche les contacts directs (appel + WhatsApp).

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store';
import { Headphones, X, Send, Sparkles, Phone, MessageSquare, RefreshCw } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  escalated?: boolean;
  isError?: boolean;
}

const STORAGE_KEY = 'socline-support-chat';

const WELCOME_MESSAGE =
  'Bonjour 👋 Je suis Soco, l\'assistant Socline.\nJe peux vous renseigner sur les formules et prix, les abonnements, le portefeuille, les codes promo ou le suivi de votre lavage. Comment puis-je vous aider ?';

const QUICK_QUESTIONS = [
  'Comment réserver un lavage ?',
  'Prix des formules',
  'C\'est quoi les abonnements ?',
  'Comment recharger mon portefeuille ?',
  'Parler à un humain',
];

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

export function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isWriting, setIsWriting] = useState(false); // délai naturel avant la réponse
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restaure la conversation de la session au montage.
  useEffect(() => {
    setMessages(loadStoredMessages());
  }, []);

  // Persistance (session) à chaque changement.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messages.length > 0) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll vers le dernier message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, isWriting, isOpen]);

  // Événement global : ouvrir depuis le bloc support du profil.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('socline:open-support', open);
    return () => window.removeEventListener('socline:open-support', open);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isSending) return;

      const history = [...messages, { role: 'user' as const, content }];
      setMessages(history);
      setInput('');
      setIsSending(true);
      setIsWriting(true);

      try {
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map(({ role, content: c }) => ({ role, content: c })),
          }),
        });
        const payload = await res.json().catch(() => null);

        // Petit délai pour un rendu naturel (l'API peut répondre très vite).
        await new Promise((r) => setTimeout(r, 450));
        setIsWriting(false);

        if (!res.ok || !payload?.reply) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                payload?.error ||
                'Oups, la connexion a échoué. Réessayez dans un instant ou appelez le +228 71 99 81 55.',
              isError: true,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: payload.reply,
              escalated: Boolean(payload.escalated),
            },
          ]);
        }
      } catch {
        setIsWriting(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Oups, la connexion a échoué. Vérifiez votre réseau et réessayez.',
            isError: true,
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [messages, isSending]
  );

  const resetConversation = () => {
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
    window.sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
    }
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  return (
    <>
      {/* Bulle flottante — au-dessus de la barre de navigation (onglet Profil) */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Ouvrir l'assistant d'aide Soco"
          className="fixed right-4 bottom-[calc(4.25rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))] z-40 w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-light shadow-lg shadow-brand/30 grid place-items-center active:scale-90 transition-transform"
        >
          <span className="absolute inset-0 rounded-full bg-brand/25 animate-ping [animation-duration:2.5s]" aria-hidden="true" />
          <Headphones className="w-6 h-6 text-white relative" strokeWidth={2.2} />
        </button>
      )}

      {/* Panneau plein écran */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-app"
          role="dialog"
          aria-modal="true"
          aria-label="Assistant d'aide Soco"
        >
          {/* En-tête */}
          <div className="bg-gradient-to-br from-ink to-ink-2 px-4 pt-[calc(0.9rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] pb-3.5 flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-brand to-brand-light grid place-items-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#1B1B2F]" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-bold text-white leading-tight">Soco · Assistant Socline</p>
              <p className="text-detail text-white/60">Besoin d&apos;aide ? Une réponse rapide, 7j/7</p>
            </div>
            <button
              onClick={resetConversation}
              aria-label="Recommencer la conversation"
              className="w-9 h-9 rounded-[11px] bg-white/10 grid place-items-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-[17px] h-[17px] text-white/80" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer l'assistant"
              className="w-9 h-9 rounded-[11px] bg-white/10 grid place-items-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <X className="w-[19px] h-[19px] text-white" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-body leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-brand text-white rounded-br-md'
                        : msg.isError
                          ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-md'
                          : 'bg-surface border border-line text-ink rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Carte d'escalade : contacts directs après transmission */}
                  {msg.escalated && (
                    <div className="mt-2 p-3 rounded-card bg-[#E8F5E9] border border-[#A5D6A7] space-y-2.5">
                      <p className="text-detail font-bold text-[#1B5E20] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                        Demande transmise à l&apos;équipe
                      </p>
                      <p className="text-detail text-[#2E7D32] leading-relaxed">
                        Un agent Socline vous répondra très vite (7j/7). Vous pouvez aussi nous joindre
                        directement :
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href="tel:+22871998155"
                          className="flex items-center justify-center gap-1.5 bg-white border border-[#A5D6A7] text-[#1B5E20] rounded-btn py-2 text-detail font-bold min-h-[40px] active:scale-95 transition-transform"
                        >
                          <Phone className="w-4 h-4" />
                          Appeler
                        </a>
                        <a
                          href="https://wa.me/22871998155?text=Bonjour%2C%20j%27ai%20un%20probl%C3%A8me%20avec%20l%27application%20Socline."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white rounded-btn py-2 text-detail font-bold min-h-[40px] active:scale-95 transition-transform"
                        >
                          <MessageSquare className="w-4 h-4" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Indicateur de saisie */}
            {(isWriting || isSending) && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface border border-line flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-soft animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="sr-only">Soco est en train d&apos;écrire…</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions rapides (tant que la conversation est courte) */}
          {messages.length <= 2 && !isSending && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="flex-shrink-0 text-detail font-semibold text-brand bg-brand-soft rounded-pill px-3.5 py-2 active:scale-95 transition-transform whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Zone de saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 pb-[calc(0.75rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))] bg-surface border-t border-line flex items-center gap-2 flex-shrink-0"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre message…"
              aria-label="Votre message à l'assistant"
              maxLength={1000}
              className="flex-1 h-11 rounded-pill border border-line bg-app px-4 text-body text-ink placeholder:text-soft focus:outline-none focus:border-brand focus:ring-brand/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Envoyer"
              className="w-11 h-11 rounded-full bg-brand grid place-items-center flex-shrink-0 disabled:opacity-40 active:scale-90 transition-transform"
            >
              <Send className="w-[18px] h-[18px] text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
