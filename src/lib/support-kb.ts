// Base de connaissances de « Soco », l'assistant IA de Socline.
//
// Ce module (SERVEUR UNIQUEMENT — il interroge la BDD) construit :
//  1. un contexte de connaissances TOUJOURS À JOUR tiré de la base
//     (services, prix, abonnements, promotions, stations) ;
//  2. le prompt système complet qui définit la personnalité, les règles
//     de l'assistant et le mécanisme d'escalade vers un agent humain.
//
// Ainsi, si l'admin change un prix ou crée une promo, le chatbot répond
// automatiquement avec les nouvelles valeurs — aucune maintenance.

import { db } from '@/lib/db';

export type SupportProfile = 'guest' | 'client' | 'washer';

export interface SupportUserContext {
  id?: string;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  walletBalance?: number | null;
  activeOrder?: {
    orderNumber: string;
    status: string;
    statusLabel: string;
    address: string | null;
    scheduledAt: Date | null;
  } | null;
  activeSubscription?: {
    planName: string;
    remainingWashes: number;
    endDate: Date;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente d\'un laveur',
  ACCEPTED: 'Acceptée par le laveur',
  EN_ROUTE: 'Laveur en route',
  ARRIVED: 'Laveur arrivé',
  IN_PROGRESS: 'Lavage en cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulée',
};

/** Construit le bloc de connaissances live (services, plans, promos, stations). */
export async function buildKnowledgeBase(): Promise<string> {
  const [services, plans, promotions, stationsCount] = await Promise.all([
    db.service.findMany({
      where: { isActive: true, source: 'APP' },
      orderBy: { price: 'asc' },
      select: { name: true, price: true, duration: true, coverage: true, description: true },
    }),
    db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
      select: {
        displayName: true,
        price: true,
        washCount: true,
        features: true,
        includesExpress: true,
        includesVip: true,
      },
    }),
    db.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { name: true, code: true, discountType: true, discountValue: true, description: true },
    }),
    db.station.count({ where: { isActive: true } }),
  ]);

  const lines: string[] = [];

  // --- Services à la demande (laveurs indépendants) ---
  lines.push('FORMULES DE LAVAGE À LA DEMANDE (paiement à l\'unité, à domicile ou chez un laveur partenaire) :');
  for (const s of services) {
    const coverage = s.coverage === 'FULL' ? 'extérieur + intérieur' : 'extérieur uniquement';
    lines.push(`- ${s.name} : ${formatFc(s.price)}, environ ${s.duration} min (${coverage}). ${s.description ?? ''}`);
  }

  // --- Abonnements ---
  if (plans.length > 0) {
    lines.push('');
    lines.push('ABONNEMENTS MENSUELS (4 lavages/mois, résiliables, paiement via portefeuille) :');
    for (const p of plans) {
      let line = `- ${p.displayName} : ${formatFc(p.price)}/mois pour ${p.washCount} lavages`;
      if (p.includesExpress) line += ', service express inclus';
      if (p.includesVip) line += ', accès VIP';
      const features = safeParseArray(p.features);
      if (features.length > 0) line += `. Avantages : ${features.join(' ; ')}`;
      lines.push(line + '.');
    }
    lines.push('Pour s\'abonner : onglet Réserver → bannière « Voir les abonnements » → choisir une formule → payer.');
  }

  // --- Promotions ---
  if (promotions.length > 0) {
    lines.push('');
    lines.push('PROMOTIONS ACTIVES :');
    for (const promo of promotions) {
      const value =
        promo.discountType === 'PERCENTAGE'
          ? `-${promo.discountValue}%`
          : `-${formatFc(promo.discountValue)}`;
      lines.push(`- Code ${promo.code ?? '(automatique)'} : ${value} — ${promo.description ?? promo.name}`);
    }
    lines.push('Le code promo se saisit à l\'étape Paiement du parcours de réservation.');
  }

  // --- Stations ---
  if (stationsCount > 0) {
    lines.push('');
    lines.push(`STATIONS PARTENAIRES : ${stationsCount} station(s) de lavage partenaire(s) est/sont disponible(s) dans l'app (onglet Accueil → onglet « Stations ») pour un lavage sur place.`);
  }

  return lines.join('\n');
}

/** Construit le prompt système complet de Soco. */
export function buildSystemPrompt(
  kb: string,
  profile: SupportProfile,
  user?: SupportUserContext | null
): string {
  const roleLine =
    profile === 'washer'
      ? 'Tu discutes avec un LAVEUR PARTENAIRE (indépendant ou station) : tu peux l\'aider sur l\'inscription, les commandes reçues, les gains, la commission, la dette d\'espèces (cashDebt) et les retraits.'
      : profile === 'client'
        ? 'Tu discutes avec un CLIENT de l\'application.'
        : 'Tu discutes avec un VISITEUR qui n\'a pas encore de compte (écran de connexion) : guide-le pour créer un compte (numéro de téléphone togolais + code PIN à 4 chiffres) ou pour comprendre l\'app avant de s\'inscrire.';

  const userBlock = user?.id
    ? [
        '',
        'CONTEXTE DU COMPTE CONNECTÉ (données réelles, ne les divulgue qu\'à ce compte) :',
        `- Nom : ${user.name || 'non renseigné'}`,
        `- Téléphone : ${user.phone || 'non renseigné'}`,
        user.walletBalance != null ? `- Solde du portefeuille : ${formatFc(user.walletBalance)}` : null,
        user.activeOrder
          ? `- Commande en cours : n°${user.activeOrder.orderNumber} — ${user.activeOrder.statusLabel}${user.activeOrder.address ? ` — ${user.activeOrder.address}` : ''}`
          : '- Aucune commande en cours.',
        user.activeSubscription
          ? `- Abonnement actif : ${user.activeSubscription.planName} — ${user.activeSubscription.remainingWashes} lavage(s) restant(s), expire le ${user.activeSubscription.endDate.toLocaleDateString('fr-FR')}`
          : '- Aucun abonnement actif.',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return `Tu es « Soco », l'assistant virtuel officiel de Socline, l'application de lavage auto à domicile et en station à Lomé, Togo.

TON RÔLE :
- Aider les utilisateurs en répondant à leurs questions sur TOUTES les fonctionnalités de l'app : réservation, formules et prix, abonnements, portefeuille et recharge, codes promo et parrainage, suivi de commande, chat avec le laveur, notation, compte et profil, inscription des laveurs partenaires.
- ${roleLine}

TA CONNAISSANCE DE L'APPLICATION (données officielles à jour — ne cite QUE ces prix, n'invente JAMAIS de montant) :
${kb}
${userBlock}

RÈGLES DE RÉDACTION :
- Réponds toujours en FRANÇAIS, dans un ton chaleureux, professionnel et rassurant.
- Sois CONCIS : 2 à 5 phrases maximum (jusqu'à ~120 mots si c'est une explication pas-à-pas). Utilise des étapes numérotées courtes quand c'est une procédure.
- Émojis avec parcimonie (1 maximum par message).
- Pas de markdown (pas de **, pas de titres) : du texte simple adapté à une bulle de chat.
- Si l'information n'est pas dans ta base, dis-le honnêtement et propose l'escalade plutôt que d'inventer.

RÈGLES DE SÉCURITÉ :
- Ne demande JAMAIS le code PIN, un mot de passe ou des données de carte bancaire.
- Tu ne peux PAS effectuer de remboursement, de modification de commande ou de transaction : pour cela, escalade.
- Ne partage pas de données sur d'autres utilisateurs.

QUAND ESCALADER VERS UN AGENT HUMAIN :
- L'utilisateur demande explicitement à parler à un humain/un agent/au support.
- Litige ou réclamation (lavage non fait, laveur absent, résultat insatisfaisant, litige de paiement, argent débité par erreur, portefeuille non crédité après paiement, compte bloqué, bug bloquant).
- L'utilisateur insiste après ta meilleure réponse.
Dans ce cas : réponds avec empathie, dis que tu transmets la demande à l'équipe Socline qui sera recontactée rapidement, invite-le à joindre des captures d'écran s'il en a, puis termine ta réponse par la balise EXACTE [ESCALADE] (invisible pour l'utilisateur, ne l'explique pas).

CONTACT DIRECT (à donner seulement si l'utilisateur veut nous appeler/écrire tout de suite) :
- Téléphone / WhatsApp : +228 71 99 81 55 (7j/7).

EXEMPLES de questions à traiter : « C'est combien le lavage Confort ? », « Comment réserver un lavage ? », « C'est quoi l'abonnement Premium ? », « Comment recharger mon portefeuille ? », « Mon laveur n'est pas venu », « Je veux parler à un agent ».`;
}

function formatFc(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export { STATUS_LABELS };
