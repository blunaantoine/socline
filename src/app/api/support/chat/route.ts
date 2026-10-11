import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';
import {
  buildKnowledgeBase,
  buildSystemPrompt,
  STATUS_LABELS,
  type SupportProfile,
  type SupportUserContext,
} from '@/lib/support-kb';

// POST /api/support/chat — assistant IA « Soco ».
// Auth optionnelle : les invités (écran de connexion) peuvent aussi poser
// leurs questions ; les comptes connectés obtiennent en plus un contexte
// personnalisé (solde, commande en cours, abonnement).
//
// Corps : { messages: [{ role: 'user' | 'assistant', content: string }] }
// Réponse : { reply, escalated, ticketId? , supportPhone }

const ESCALATION_MARKER = '[ESCALADE]';
const SUPPORT_PHONE = '+22871998155';
const MAX_HISTORY = 12; // messages conservés (hors prompt système)
const MAX_CONTENT_LENGTH = 1500; // garde-fou anti-abus par message

// Rate-limit mémoire (par IP ou userId) : 20 messages / 5 minutes.
const rateBuckets = new Map<string, number[]>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - 5 * 60 * 1000;
  const hits = (rateBuckets.get(key) || []).filter((t) => t > windowStart);
  if (hits.length >= 20) return true;
  hits.push(now);
  rateBuckets.set(key, hits);
  return false;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Charge le contexte réel du compte connecté (portefeuille, commande, abonnement). */
async function loadUserContext(userId: string): Promise<SupportUserContext> {
  const ctx: SupportUserContext = {};
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      wallet: { select: { balance: true } },
    },
  });
  if (!user) return ctx;
  ctx.id = user.id;
  ctx.name = user.name;
  ctx.phone = user.phone;
  ctx.role = user.role;
  ctx.walletBalance = user.wallet?.balance ?? null;

  const [activeOrder, activeSub] = await Promise.all([
    db.order.findFirst({
      where: {
        OR: [{ clientId: userId }, { washerId: userId }],
        status: { in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true, status: true, address: true, scheduledAt: true },
    }),
    db.userSubscription.findFirst({
      where: { userId, isActive: true, isExpired: false, endDate: { gte: new Date() } },
      orderBy: { endDate: 'desc' },
      select: { plan: { select: { displayName: true } }, remainingWashes: true, endDate: true },
    }),
  ]);

  if (activeOrder) {
    ctx.activeOrder = {
      orderNumber: activeOrder.orderNumber,
      status: activeOrder.status,
      statusLabel: STATUS_LABELS[activeOrder.status] ?? activeOrder.status,
      address: activeOrder.address,
      scheduledAt: activeOrder.scheduledAt,
    };
  }
  if (activeSub) {
    ctx.activeSubscription = {
      planName: activeSub.plan.displayName,
      remainingWashes: activeSub.remainingWashes,
      endDate: activeSub.endDate,
    };
  }
  return ctx;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const rawMessages: unknown = body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 });
    }

    // Normalise et borne l'historique.
    const messages: ChatMessage[] = (rawMessages as any[])
      .filter(
        (m): m is ChatMessage =>
          m &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0 &&
          (m.role === 'user' || m.role === 'assistant')
      )
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CONTENT_LENGTH) }));

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'Message utilisateur requis' }, { status: 400 });
    }

    // Auth souple : session si présente, sinon invité.
    const session = await getSessionFromRequest(request);
    const profile: SupportProfile = !session
      ? 'guest'
      : session.role === 'WASHER'
        ? 'washer'
        : 'client';

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const rateKey = session?.id || ip;
    if (isRateLimited(rateKey)) {
      return NextResponse.json(
        { error: 'Trop de messages envoyés. Réessayez dans quelques minutes.' },
        { status: 429 }
      );
    }

    // Contexte utilisateur réel (connecté) + base de connaissances live.
    const [userCtx, kb] = await Promise.all([
      session ? loadUserContext(session.id) : Promise.resolve(null),
      buildKnowledgeBase(),
    ]);

    const systemPrompt = buildSystemPrompt(kb, profile, userCtx);

    // Appel LLM (backend uniquement).
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      thinking: { type: 'disabled' },
    });

    let reply = completion.choices[0]?.message?.content?.trim() || '';
    if (!reply) {
      reply =
        'Désolé, je n\'ai pas réussi à formuler une réponse. Pouvez-vous reformuler votre question ?';
    }

    // Les bulles de chat n'interprètent pas le markdown : on retire les
    // marqueurs de gras/italique que le modèle pourrait glisser.
    reply = reply
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
      .replace(/^#+\s+/gm, '')
      .trim();

    // Escalade → création d'un ticket de support pour l'équipe.
    let escalated = false;
    let ticketId: string | undefined;
    if (reply.includes(ESCALATION_MARKER)) {
      escalated = true;
      reply = reply.split(ESCALATION_MARKER)[0].trim();
      if (!reply) {
        reply =
          'Je transmets votre demande à l\'équipe Socline. Un agent vous recontactera très vite. 🙏';
      }

      const digest = messages
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Soco'} : ${m.content}`)
        .join('\n');

      const ticket = await db.supportTicket.create({
        data: {
          userId: session?.id ?? null,
          name: userCtx?.name || null,
          phone: userCtx?.phone || null,
          role: profile === 'guest' ? 'GUEST' : profile === 'washer' ? 'WASHER' : 'CLIENT',
          subject: lastUser.content.slice(0, 80),
          message: `Dernier message :\n${lastUser.content}\n\n--- Conversation avec Soco ---\n${digest}`,
          status: 'OPEN',
        },
      });
      ticketId = ticket.id;
    }

    return NextResponse.json({ reply, escalated, ticketId, supportPhone: SUPPORT_PHONE });
  } catch (error) {
    console.error('Support chat error:', error);
    return NextResponse.json(
      {
        error:
          'L\'assistant est momentanément indisponible. Réessayez ou appelez le +228 71 99 81 55.',
      },
      { status: 500 }
    );
  }
}
