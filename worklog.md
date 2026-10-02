# Worklog — Projet SocLine

Repo: https://github.com/blunaantoine/socline.git
Stack: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind 4 + shadcn/ui + Prisma (SQLite) + Zustand + socket.io (mini-service chat).

## Contexte initial (analyse Explore — Task ID 0)

- App SPA mono-page (`src/app/page.tsx`) : vues `client` / `washer` / `admin` selon rôle (zustand persist localStorage).
- Auth web : cookie httpOnly `socline_token` = base64 NON SIGNÉ de `{userId, random}` (`src/lib/auth.ts`) → usurpation possible.
- JWT Bearer (`src/lib/jwt.ts`) utilisé uniquement par les routes mobile `/api/auth/mobile/*`.
- Thème : orange #FF9800 (primaire), #F57C00 (hover), fond #FAFAFA, vert #4CAF50 (laveurs).
- Comptes seed : CLIENT 90123456/1234, WASHER 90234567/1234, ADMIN 71998155/1234, OTP test 123456.

### Problèmes identifiés (priorisés)
1. 🔴 Token cookie non signé → JWT signé requis (lib/auth.ts).
2. 🔴 IDOR : routes métier (orders, wallet, withdrawals, subscriptions, conversations, notifications, cars, addresses, washers, user/*) font confiance au userId du body/query ; routes admin/orders|washers|subscriptions|subscriptions/usages sans requireAdmin.
3. 🔴 Prix/paiements pilotés client : POST /api/orders accepte totalPrice du body ; PATCH /api/wallet débite sans lien commande ; paiement non atomique.
4. 🟠 subscriptions/validate : mismatch washerId (record Washer.id vs User.id) → 403 permanent → séances illimitées.
5. 🟠 subscriptions/user : débit wallet AVANT check abonnement actif, sans $transaction.
6. 🟠 Laveurs jamais crédités à COMPLETED (totalEarnings/completedJobs jamais incrémentés) ; seed réinitialise totalEarnings à chaque POST.
7. 🟠 OrderTracking 100% simulé (setTimeout côté client, DB reste PENDING).
8. 🟡 OTP mock renvoyé dans la réponse ; promo maxUsesPerUser ignoré ; statuts commandes sans machine à états.
9. 🟢 UX : alert() au lieu de toasts (ClientOrderFlow), "Utiliser ma position" non cliquable, section "Laveurs disponibles" jamais remplie, stats profil en dur "0 lavages", redirection après commande vers onglet subscriptions au lieu du tracking.

---
Task ID: 4-a
Agent: general-purpose
Task: Ajout requireAdmin sur les 4 routes admin non protégées

Work Log:
- Lecture complète des 4 fichiers cibles + vérification de l'export `requireAdmin` dans src/lib/auth.ts (signature conforme : `{ authorized, user, response? }`).
- Ajout de `import { requireAdmin } from '@/lib/auth';` en tête de chaque fichier.
- src/app/api/admin/orders/route.ts : check requireAdmin ajouté en première instruction de GET et PATCH (avant le try).
- src/app/api/admin/washers/route.ts : check ajouté sur POST, GET et PATCH.
- src/app/api/admin/subscriptions/route.ts : check ajouté sur GET, POST et PATCH.
- src/app/api/admin/subscriptions/usages/route.ts : check ajouté sur GET et PATCH.
- Pattern appliqué à l'identique partout : `const auth = await requireAdmin(request); if (!auth.authorized) { return auth.response!; }`.
- Relecture des 4 fichiers : accolades équilibrées, check bien placé avant le try, logique métier inchangée.
- Lint `bun run lint` (eslint .) : exécuté, 0 erreur / 0 warning.

Stage Summary:
- 9 handlers admin désormais protégés : orders (GET, PATCH), washers (POST, GET, PATCH), subscriptions (GET, POST, PATCH), subscriptions/usages (GET, PATCH).
- Toute requête sans session admin valide est rejetée via `auth.response!` (401/403 géré par requireAdmin) avant tout accès DB.
- Aucune autre modification de logique métier ; lint OK (aucune erreur préexistante détectée non plus).
- Reste ouvert (hors périmètre 4-a) : token cookie toujours non signé (usurpation possible, cf. Task 0 point 1).

---
Task ID: 5-a
Agent: general-purpose
Task: Fixs logique métier (validate abonnement, transaction abonnement, crédit laveurs, seed)

Work Log:
- Lecture worklog.md + des 5 fichiers cibles + src/lib/auth.ts + prisma/schema.prisma + appelants (WasherApp.tsx). Vérifié en DB : Washer.id = cmo8v5kgq0008qdcj88k27mc3 ≠ User.id laveur = cmo8v5kgp0006qdcjr6ot1i36 (confirme le mismatch du bug 1).
- BUG 1 (src/app/api/subscriptions/validate/route.ts, handler POST) : ajout `import { getCurrentUser }` (l.3) ; session résolue avant comparaison (l.103-114, `getCurrentUser()` → 401 si absente, puis `db.washer.findFirst({ OR: [{ id: session.id }, { userId: session.id }] })`) ; autorisation `!washerProfile || order.washerId !== washerProfile.id` → 403 sinon (l.116-120) ; `validatedBy` stocke désormais `washerProfile.id` (cohérent avec order.washerId, l.150). Transaction/décrément remainingWashes inchangés.
- BUG 2 (src/app/api/subscriptions/user/route.ts, POST) : réordonné — plan actif (l.76-78), calcul prix/durée, check abonnement actif existant AVANT tout débit (l.103-117), check solde wallet SANS débit (l.120-132), puis UNE transaction (l.141-197) : re-lecture wallet tx, garde-fou solde (throw → rollback), débit balance/totalSpent, WalletTransaction PAYMENT/COMPLETED/balanceAfter, création UserSubscription. Réponse JSON inchangée.
- BUG 3 (src/app/api/orders/route.ts PATCH l.236-336 et src/app/api/orders/[id]/route.ts PATCH l.50-156) : fetch de l'état avant update (status précédent, totalPrice, commission), `isCompletion = status==='COMPLETED' && ancien!=='COMPLETED'` (anti double-crédit), `washerAmount = max(0, totalPrice - commission)`, puis `$transaction` unique : update Order + update Washer (`totalEarnings: increment washerAmount`, `completedJobs: increment 1` si order.washerId). Pas de WalletTransaction créée. Logique ACCEPTED/conversation/tracking conservée. Guard `orderId requis` (400) ajouté sur /api/orders.
- BUG 4 (src/app/api/seed/route.ts l.159-170) : la branche "washer existant" ne fait plus `totalEarnings: 20000` — update limité aux champs de config (isAvailable, isVerified). La création initiale garde ses valeurs de démo (20000).
- Adjacent pré-existant découvert et corrigé (nécessaire pour que le fix BUG 3 soit fonctionnel) : src/app/api/orders/[id]/route.ts utilisait `params: { id: string }` synchrone (seule route dynamique non migrée — Next 16 attend Promise) → `params.id` était undefined à l'exécution (GET 500 confirmé par curl avant fix). Migré GET + PATCH vers `params: Promise<{ id: string }>` + `await params` (pattern identique aux autres routes [id] du repo).
- Relecture complète des fichiers, lint `bun run lint` : 0 erreur / 0 warning. tsc --noEmit : 24 erreurs TOUTES pré-existantes (POST /api/orders l.141-227 `let subscription = null`, seed l.90, subscriptions/seed, subscriptions/user PATCH l.259 `plan.service`, etc.) — le count est passé de 25 à 24 (l'erreur .next/dev/types/validator.ts sur orders/[id] a disparu grâce à la migration params).
- Tests curl (sans polluer les données) : login laveur 200 ; GET /api/subscriptions/user?userId=<laveur> 200 ; POST validate sans ordre réel → 404 ; PATCH /api/orders sans orderId → 400, orderId inexistant → 404 ; PATCH /api/orders/[id] inexistant → 404 (plus 500) ; GET /api/orders/[id] → 200 (totalPrice 1500, commission 225) ; login admin 71998155 + GET /api/admin/orders 200 (2 commandes : ACCEPTED laveur assigné, PENDING). Aucune transition COMPLETED réelle exécutée.
- Test non-destructif du BUG 4 : sentinel totalEarnings=25500 sur le laveur test → POST /api/seed → 25500 conservé (avant : écrasé à 20000), isAvailable/isVerified toujours true → valeur restaurée à 20000 ensuite.

Stage Summary:
- Validation d'abonnement opérationnelle : le laveur est résolu depuis la session (cookie JWT), l'autorisation compare le record Washer, `remainingWashes` sera réellement décrémenté ; plus de séances illimitées.
- Souscription abonnement : aucun débit wallet avant validations ; débit + WalletTransaction + UserSubscription atomiques ($transaction) — plus d'argent perdu sur 400.
- Crédit laveurs : à la transition → COMPLETED, le washer reçoit totalEarnings += totalPrice - commission (clamp ≥ 0) et completedJobs += 1, dans la même transaction que l'update de l'Order, avec anti double-crédit sur le statut précédent.
- Seed idempotent : totalEarnings/completedJobs du laveur ne sont plus réécrasés à chaque POST /api/seed (appelé au montage du Home).
- GET/PATCH /api/orders/[id] refonctionnent (migration params Next 16, pré-requis découvert pendant la tâche).
- Points signalés, NON traités (hors périmètre) : (1) POST /api/seed réactive/étend automatiquement les promotions expirées à chaque appel (l.239-255) — réécriture de données de config à chaque montage du Home ; (2) PATCH /api/orders/[id] écrit `washerId` du body brut dans order.washerId sans résolution User→Washer (contrairement à /api/orders PATCH) → risque d'ID mismatch si un jour cette route est appelée avec un User.id ; (3) IDOR général (userId du body) et erreurs tsc pré-existantes toujours ouverts (cf. Task 0).

---
Task ID: 6-a
Agent: general-purpose
Task: Améliorations UX (toasts, redirection tracking, laveurs dispo, stats profil, géoloc, voir tout)

Work Log:
- Lecture worklog.md + ClientApp.tsx (1045 l.), ClientOrderFlow.tsx (866 l.), api/washers/route.ts, api/user/activity/route.ts, api/orders/route.ts (GET), prisma/schema.prisma (model Washer), store/index.ts, OrderTracking.tsx (grep PENDING).
- FIX 1 (ClientOrderFlow.tsx) : les 6 alert() remplacés par toast.error() (sonner) — session expirée ×2 (l.214/306), solde insuffisant, erreur paiement wallet, erreur création commande (data.error fallback), erreur connexion. Import `import { toast } from 'sonner'` ajouté. Messages conservés à l'identique. `grep alert(` → 0 match.
- FIX 2 (ClientApp.tsx) : onOrderComplete (l.360-367) setActiveTab('subscriptions') → setActiveTab('home') + setShowTracking(true). Blocage découvert : la gate d'affichage d'OrderTracking (l.260) excluait PENDING alors qu'une commande fraîchement créée est PENDING (OrderTracking gère bien PENDING : STATUS_CONFIG + timers de simulation) → 'PENDING' ajouté à la liste des statuts. useOrdersStore non persisté → pas de faux tracking au rechargement.
- FIX 3 (ClientApp.tsx) : nouveau useEffect (l.171-190) fetch('/api/washers?available=true') → setNearbyWashers(data.washers) (shape API vérifiée par curl : rating, completedJobs, user{name,avatar}, isAvailable) + état isLoadingWashers passé à HomeContent (nouvelle prop washersLoading?). Section "Laveurs disponibles" : skeletons animate-pulse pendant le fetch ; carte extraite dans un composant WasherCard (module-level) affichant avatar (img si user.avatar sinon initiale orange), nom, note étoile, nb lavages (completedJobs) ; si réponse vide → comportement inchangé (liste vide). Garde filtre isAvailable + style cards blanches.
- FIX 4 (ClientApp.tsx, ProfileContent) : /api/user/activity renvoie une liste d'activités sans agrégats → choix simple retenu : fetch GET /api/orders?userId=<id> (vérifié curl : {success, orders[]}) au montage du profil, calcul client-side = count status COMPLETED + sum totalPrice des COMPLETED. Stats affichées : "Lavages" (orange) = nb COMPLETED, "Dépensé" (relabelé depuis "Économisé") = `${spent.toLocaleString('fr-FR')} F` ; spinner Loader2 pendant le fetch ; "Note" conservée à "-" (pas de données de note client dans le modèle).
- FIX 5 (ClientOrderFlow.tsx) : "Utiliser ma position actuelle" (div statique) → bouton onClick={handleUseCurrentLocation} : navigator.geolocation.getCurrentPosition (enableHighAccuracy, timeout 10s) → setCoords({latitude, longitude}) + setAddress('Position actuelle') ; état "Localisation…" avec Loader2 pendant le fetch ; erreur/refus/geolocation indisponible → toast.error('Impossible d'obtenir votre position') ; icône CheckCircle + label "Position actuelle" une fois obtenue. POST /api/orders envoie désormais latitude: coords?.latitude ?? userLocation?.latitude (idem longitude).
- FIX 6 (ClientApp.tsx l.887-894) : le "Voir tout" sans handler était celui de la section "Laveurs disponibles" (pas les promos) → toggle showAllWashers : carrousel horizontal ↔ grille grid-cols-4 de tous les laveurs (même WasherCard), label "Voir tout" ↔ "Réduire". Bouton masqué si ≤ 4 laveurs (plus de bouton mort). Pas de nouvelle page. (2 autres "Voir tout" existent dans WalletScreen.tsx — hors périmètre, non touchés.)
- Lint `bun run lint` : 0 erreur / 0 warning. dev.log après edits : "✓ Compiled" répétés, GET / 200, aucune erreur de compilation. Tests curl : login client 90123456 → 200 (userId cmo8v5kgm0005qdcjpdswcy5s) ; GET /api/washers?available=true → 200, 2 laveurs isAvailable (user{name,avatar}, rating, completedJobs) ; GET /api/orders?userId=<client> → 200 {success, orders: []} (0 commande → stats afficheront 0/0 F, valeurs réelles) ; GET /api/user/activity?userId=<client> → 200 {activities: []} (confirmé sans agrégats).

Stage Summary:
- Plus aucun alert() dans le flux de commande : tous les retours utilisateur passent par des toasts sonner (Toaster déjà monté dans page.tsx).
- Après une commande réussie, l'utilisateur atterrit directement sur l'écran de suivi (OrderTracking rendu dès le statut PENDING) ; au retour du tracking il est sur l'onglet Accueil (plus l'onglet Abonnements).
- La section "Laveurs disponibles" du Home est alimentée par GET /api/washers?available=true avec skeletons de chargement, cartes enrichies (avatar/initiale, note, nb lavages) et un "Voir tout" fonctionnel (bascule carrousel ↔ grille complète).
- Les stats du profil client sont réelles (lavages terminés + total dépensé en F, calculés depuis GET /api/orders?userId=) au lieu de "0" en dur.
- "Utiliser ma position actuelle" est fonctionnel : géoloc navigateur → coordonnées envoyées à POST /api/orders + label "Position actuelle" + toast d'erreur en cas de refus.
- Aucun changement backend ; aucun commit ; lint OK ; serveur compile sans erreur.

## Session complète — Récapitulatif final

| Commit | Amélioration | Vérification |
|---|---|---|
| `d65f33b` | 🔐 Auth: JWT signé (HS256/7d) pour cookie session + requireAdmin sur 9 handlers (admin/orders, admin/washers, admin/subscriptions[/usages]) + /api/auth/me via session | Tokens forgés rejetés 401; admin OK avec cookie |
| `6cca45f` | 🐛 Fixs: validate abonnement (mismatch Washer.id/User.id), $transaction abonnement (validations avant débit), crédit laveur à COMPLETED (totalEarnings += total-commission, anti double-crédit), seed ne reset plus les gains, orders/[id] migré Promise params Next 16 | Order 1500F → laveur +1275F (20000→21275, jobs 0→1) |
| `10d532b` | ✨ UX: 6 alert()→toasts sonner, redirection tracking après commande (PENDING inclus), section laveurs dispo réelle + skeletons, stats profil réelles, géoloc fonctionnelle, "Voir tout" toggle | Agent Browser: login→booking→promo WELCOME20 (−500F)→commande→tracking; toast géoloc OK |

Secrets JWT ajoutés au `.env` (JWT_SECRET, JWT_REFRESH_SECRET — ne jamais commit de vrais secrets en prod).

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Remplacer le contrat téléchargeable par le PDF officiel + adapter le site au contrat

Work Log:
- Déployé upload/Contrat_Partenaire_SOCLINE_a_imprimer.pdf (3 pages, 1.5 MB) dans public/documents/
- AuthScreen.tsx: supprimé le faux contrat .txt généré en blob; le bouton télécharge maintenant le PDF officiel
  via <a href="/documents/..." download>; écran "Devenir Laveur" réécrit selon le contrat:
  * Avantages: "Revenus progressifs de 60% à 80%", horaires libres, paiements hebdomadaires, relevé dans l'app (Articles 2/4/5)
  * Pièces à fournir (Article 8): CNI OU carte d'électeur, photo identité (page 1), casier judiciaire bulletin n°3 <3 mois, contrat signé+paraphé
  * Nouvelle section "Rémunération progressive" avec le barème 5 niveaux du contrat (60→80%)
  * Encart: paiements hebdomadaires + contestation sous 7 jours
  * Processus d'inscription mis à jour (PDF 3 pages, majuscules, paraphe, Article 8)
- src/lib/washer-level.ts (nouveau): PARTNER_LEVELS (Départ 60/Confirmé 65/Expert 70/Référent 75/Excellence 80%),
  computePartnerLevel(stats) — évaluation continue conforme à l'Article 5 (taux figé sur la commande à l'acceptation)
- POST /api/orders: commission par défaut 40% (niveau 1) au lieu de 15%
- PATCH /api/orders: à ACCEPTED, commission recalculée selon le niveau du laveur (completedJobs, rating, taux annulation)
- GET /api/washers/[userId]: renvoie partnerLevel + stats + nextLevel
- admin/washers: gains = sum(totalPrice) - sum(commission réelle) au lieu de *0.15
- WasherApp.tsx: bandeau "Niveau X – Nom · votre part %" avec progression vers le niveau suivant

Stage Summary:
- E2E vérifié navigateur + curl: commande 2500 F → commission création 1000 F (40%, ex-375 F/15%),
  acceptation laveur Niv.1 → part laveur 1500 F (60%), COMPLETED → totalEarnings 21275→22775, jobs 1→2
- Dashboard laveur affiche "Niveau 1 – Départ, votre part 60%", progression 2/30 → Niv.2 (65%)
- Lint 0 erreur; PDF servi statiquement (200, 1550175 octets)
