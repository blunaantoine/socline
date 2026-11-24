import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Politique de confidentialité — page publique (lisible sans compte).
 * Exigée par la BoD-TPME (« respectueuse des règles de protection des données
 * à caractère personnel ») et liée depuis l'inscription, le compte client et
 * le profil laveur / station.
 *
 * Le contenu décrit ce que l'application collecte RÉELLEMENT (schéma Prisma,
 * API) et les prestataires effectivement utilisés dans le code. À tenir à jour
 * à chaque nouvelle donnée ou nouveau prestataire.
 */
export const metadata: Metadata = {
  title: 'Politique de confidentialité — Socline',
  description:
    'Quelles données Socline collecte, pourquoi, combien de temps elles sont conservées et comment exercer vos droits.',
  alternates: { canonical: '/confidentialite' },
};

const UPDATED = '24 novembre 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-section text-ink">{title}</h2>
      <div className="space-y-3 text-body text-ink/90 leading-relaxed">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[520px] text-detail border border-line rounded-card overflow-hidden">
        <thead className="bg-ink text-white">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="text-left font-semibold px-3 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-app' : 'bg-surface'}>
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2.5 align-top ${j === 0 ? 'font-semibold text-ink' : 'text-soft'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConfidentialitePage() {
  return (
    <main className="min-h-dvh bg-app">
      <header className="bg-ink text-white">
        <div className="max-w-3xl mx-auto px-4 pt-[calc(1.5rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] pb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-detail text-white/80 min-h-[44px] -my-2">
            ← Retour à Socline
          </Link>
          <h1 className="text-display mt-2">Politique de confidentialité</h1>
          <p className="text-detail text-white/70 mt-1">Dernière mise à jour : {UPDATED}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 pb-[calc(2rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
        <p className="text-body text-ink leading-relaxed">
          Socline est une application de lavage automobile à domicile et en station, à Lomé (Togo). Cette page explique,
          simplement, quelles informations nous collectons quand vous utilisez Socline, pourquoi, avec qui elles sont
          partagées, combien de temps nous les gardons et comment exercer vos droits. Elle s&apos;applique aux clients,
          aux laveurs indépendants et aux stations partenaires.
        </p>

        <Section title="1. Qui est responsable de vos données ?">
          <p>
            Le responsable du traitement est <strong>Socline</strong>, entreprise en cours d&apos;immatriculation à Lomé,
            Togo. Pour toute question sur vos données, contactez-nous par téléphone ou WhatsApp au{' '}
            <a className="text-brand-ink font-semibold underline underline-offset-2" href="tel:+22871998155">+228 71 99 81 55</a>,
            ou depuis l&apos;application (Compte → « Besoin d&apos;aide ? »).
          </p>
          <p>
            Nous traitons vos données conformément à la loi togolaise n° 2019-014 du 29 octobre 2019 relative à la
            protection des données à caractère personnel.
          </p>
        </Section>

        <Section title="2. Quelles données collectons-nous, et pourquoi ?">
          <Table
            head={['Données', 'Pourquoi', 'Qui est concerné']}
            rows={[
              ['Nom, numéro de téléphone, e-mail (facultatif), photo de profil (facultative)', 'Créer et sécuriser votre compte, vous contacter au sujet d’une commande', 'Tous'],
              ['Code PIN (enregistré chiffré, jamais en clair) et code de vérification SMS', 'Vous connecter en toute sécurité et vérifier que le numéro vous appartient', 'Tous'],
              ['Véhicules : marque, modèle, couleur, plaque, année, photo', 'Permettre au laveur de reconnaître votre voiture', 'Clients'],
              ['Adresses et position GPS au moment de la commande', 'Savoir où effectuer le lavage', 'Clients'],
              ['Position GPS du laveur pendant une commande en cours', 'Afficher au client l’arrivée du laveur en direct (uniquement aux étapes « En route » et « Arrivé »)', 'Laveurs'],
              ['Photos avant et après le lavage', 'Prouver le travail réalisé et traiter une éventuelle réclamation', 'Clients et laveurs'],
              ['Commandes, paiements, solde du portefeuille, abonnements, retraits', 'Facturer, payer les laveurs et les stations, tenir la comptabilité', 'Tous'],
              ['Numéros Mobile Money de retrait', 'Verser leurs gains aux laveurs et aux stations', 'Laveurs et stations'],
              ['Pièce d’identité, informations bancaires (si fournies)', 'Vérifier l’identité d’un laveur partenaire avant de lui confier des clients', 'Laveurs'],
              ['Informations de la station : nom, adresse, téléphone, photos, services et prix', 'Présenter la station et ses offres aux clients', 'Stations'],
              ['Messages échangés entre client et laveur', 'Organiser le lavage (arrivée, accès, consignes)', 'Clients et laveurs'],
              ['Notes et avis', 'Informer les autres clients et améliorer la qualité du service', 'Clients'],
              ['Identifiant de notifications de l’appareil', 'Vous envoyer les notifications de suivi de commande', 'Tous'],
              ['Conversation avec l’assistant « Soco » (facultatif) et, si vous êtes connecté, votre prénom, votre solde, le numéro et le statut de votre commande en cours et votre abonnement', 'Répondre à vos questions sur l’application de façon personnalisée', 'Tous'],
            ]}
          />
          <p>
            Nous ne collectons ces données que lorsque c&apos;est nécessaire au service : la position GPS, par exemple,
            n&apos;est utilisée que pendant une commande et seulement si vous l&apos;autorisez sur votre téléphone. Nous ne
            vendons jamais vos données et ne les utilisons pas pour de la publicité ciblée.
          </p>
        </Section>

        <Section title="3. Sur quelle base utilisons-nous vos données ?">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>L&apos;exécution du service</strong> que vous demandez : créer votre compte, réaliser et payer un lavage, suivre une commande.</li>
            <li><strong>Votre consentement</strong> : accès à la position GPS et à l&apos;appareil photo, notifications. Vous pouvez le retirer à tout moment dans les réglages de votre téléphone.</li>
            <li><strong>Nos obligations légales</strong> : conservation des informations de paiement pour la comptabilité.</li>
            <li><strong>Notre intérêt légitime</strong> : sécurité des comptes, prévention de la fraude, amélioration du service.</li>
          </ul>
        </Section>

        <Section title="4. Avec qui vos données sont-elles partagées ?">
          <p>Uniquement avec les personnes et les prestataires nécessaires au service :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Le laveur ou la station</strong> qui réalise votre lavage : votre nom, votre adresse ou position, votre véhicule et vos messages pour cette commande ; <strong>le client</strong> voit le nom, la note et la position du laveur pendant la commande.</li>
            <li><strong>Les prestataires de paiement</strong> : PayDunya et les opérateurs Mobile Money (Mixx by Yas, Flooz), pour traiter les paiements.</li>
            <li><strong>Le prestataire d&apos;envoi de SMS</strong> (Africa&apos;s Talking), pour les codes de vérification.</li>
            <li><strong>Google Firebase</strong>, pour l&apos;envoi des notifications sur votre téléphone.</li>
            <li><strong>OpenStreetMap / Nominatim</strong>, pour afficher les cartes et retrouver une adresse à partir d&apos;une position.</li>
            <li><strong>Z.ai</strong>, le service d&apos;intelligence artificielle qui fait fonctionner l&apos;assistant « Soco », dont l&apos;usage est facultatif. Il reçoit uniquement les derniers messages de votre conversation avec Soco et, si vous êtes connecté, votre nom, le solde de votre portefeuille, le numéro et le statut de votre commande en cours et votre abonnement, pour vous répondre de façon personnalisée. Il ne reçoit ni votre numéro de téléphone, ni votre code PIN, ni votre position, ni vos photos, ni vos numéros Mobile Money. Ce traitement a lieu hors du Togo : n&apos;écrivez pas d&apos;informations sensibles à Soco.</li>
            <li><strong>Notre hébergeur</strong>, qui héberge le serveur de l&apos;application.</li>
            <li><strong>Les autorités</strong>, uniquement si la loi nous y oblige.</li>
          </ul>
          <p>
            Certains de ces prestataires peuvent traiter les données hors du Togo. Nous ne leur transmettons que ce qui
            est nécessaire à leur mission.
          </p>
        </Section>

        <Section title="5. Combien de temps gardons-nous vos données ?">
          <Table
            head={['Données', 'Durée de conservation']}
            rows={[
              ['Compte, véhicules, adresses', 'Tant que votre compte est actif, puis supprimées dans les 30 jours suivant votre demande de suppression'],
              ['Commandes, paiements, retraits', '10 ans, pour nos obligations comptables'],
              ['Positions GPS du laveur pendant une commande', '12 mois après la commande'],
              ['Photos avant / après, messages', '12 mois après la commande'],
              ['Codes de vérification SMS', 'Quelques minutes (validité de 5 minutes), puis invalidés'],
              ['Pièce d’identité d’un laveur', 'Pendant la durée du partenariat, puis supprimée dans les 3 mois'],
            ]}
          />
        </Section>

        <Section title="6. Comment protégeons-nous vos données ?">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Toutes les communications passent par une connexion chiffrée (HTTPS).</li>
            <li>Votre code PIN est enregistré sous forme chiffrée : personne, pas même Socline, ne peut le lire.</li>
            <li>Les sessions sont signées et expirent ; les tentatives de connexion répétées sont limitées.</li>
            <li>Chaque utilisateur n&apos;accède qu&apos;aux informations nécessaires à son rôle (client, laveur, station).</li>
            <li>Les accès d&apos;administration sont réservés à l&apos;équipe Socline.</li>
          </ul>
        </Section>

        <Section title="7. Vos droits">
          <p>Vous pouvez à tout moment :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>accéder</strong> à vos données et en obtenir une copie ;</li>
            <li><strong>les corriger</strong> (la plupart sont modifiables directement dans l&apos;application, rubrique Compte) ;</li>
            <li><strong>demander leur suppression</strong> et la fermeture de votre compte ;</li>
            <li><strong>vous opposer</strong> à un traitement ou <strong>retirer votre consentement</strong> (position, appareil photo, notifications) dans les réglages de votre téléphone.</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous au{' '}
            <a className="text-brand-ink font-semibold underline underline-offset-2" href="tel:+22871998155">+228 71 99 81 55</a>{' '}
            (appel ou WhatsApp). Nous répondons dans un délai d&apos;un mois. Si vous estimez que vos droits ne sont pas
            respectés, vous pouvez saisir l&apos;Instance de protection des données à caractère personnel (IPDCP) du Togo.
          </p>
        </Section>

        <Section title="8. Mineurs">
          <p>Socline s&apos;adresse aux personnes majeures. Nous ne collectons pas sciemment de données concernant des mineurs.</p>
        </Section>

        <Section title="9. Modifications de cette politique">
          <p>
            Nous pouvons mettre à jour cette page, par exemple lorsque nous ajoutons un service. La date de dernière mise
            à jour figure en haut. En cas de changement important, nous vous en informerons dans l&apos;application.
          </p>
        </Section>
      </div>
    </main>
  );
}
