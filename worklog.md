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
---
Task ID: 1-b
Agent: general-purpose
Task: OTP réel — stockage hashé en DB (OtpCode), expiry 5 min, max 5 tentatives, rate limit envoi, intégration SMS (Africa's Talking/Twilio/HTTP), mode démo sans provider

Work Log:
- Lecture worklog.md, .env (placeholders SMS commentés → mode démo actif), schema.prisma (model OtpCode présent, table otp_codes créée), src/lib/auth.ts (convention bcrypt 10 rounds via hashPin), src/app/api/auth/login/route.ts (style des réponses 429/400 FR), AuthScreen.tsx complet.
- NOUVEAU src/lib/sms.ts : abstraction provider. isSmsConfigured() (africastalking: API_KEY+USERNAME ; twilio: API_KEY+USERNAME+SENDER_ID ; http: WEBHOOK_URL) et sendSms(phone, message) — AT POST x-www-form-urlencoded + header apiKey (2xx = sent ssi ≥1 recipient status success/statusCode 101-102), Twilio POST Messages.json Basic auth (USERNAME=Account SID, API_KEY=Auth Token, From=SMS_SENDER_ID), http POST JSON {phone,message} vers SMS_WEBHOOK_URL. AbortController 10s, try/catch global, jamais de throw, détails d'erreur uniquement en console.error serveur (corps tronqué 300c). normalizePhone() : strip espaces/()-/., "0XXXXXXXX" (8c, Togo) → "+228XXXXXXXX", "00228…" → "+228…", sinon inchangé (documenté en commentaire).
- send-otp/route.ts réécrit : validation téléphone (8–15 chiffres après strip sauf +) ; rate limit module-level Map — 1 envoi/60s/phone → 429 'Veuillez patienter avant de demander un nouveau code', 5 envois/heure glissante/phone → 429 'Trop de codes demandés. Réessayez plus tard.' ; code via randomInt(0,1e6) zero-padded ; invalidation des codes non consommés (UPDATE otp_codes SET consumedAt) ; hash bcryptjs 10 rounds ; expiresAt = now+5min ; si SMS configuré → sendSms('Votre code Socline est X. Valable 5 minutes.'), échec loggé serveur sans leak, réponse {success, message:'Un code de vérification a été envoyé par SMS.', expiresIn:300, demoMode:false, smsSent}; mode démo → même shape + demoMode:true, demoCode (code JAMAIS retourné quand un provider est configuré) ; console.log('[OTP] code for', phone, ...) toujours (support).
- verify-otp/route.ts réécrit : lookup dernier code du phone (createdAt DESC LIMIT 1) ; aucun → 400 'Aucun code actif. Veuillez demander un nouveau code.' ; consumedAt OU expiré → 400 'Code expiré. Veuillez demander un nouveau code.' ; attempts>=5 → 400 'Trop de tentatives. Veuillez demander un nouveau code.' ; bcrypt.compare KO → attempts+1, 400 'Code invalide' ; succès → consumedAt=now puis logique EXISTANTE inchangée (find-or-create user, profil washer si role==='WASHER', generateToken + setAuthCookie, shape {success, user, token}).
- IMPORTANT (infra) : les accès OtpCode passent par $queryRaw/$executeRaw sur la table otp_codes (commentaire explicite dans les 2 routes) — le serveur dev en cours (démarré 15:20) a un require cache de @prisma/client ANTÉRIEUR au prisma generate de 17:14 : db.otpCode y est undefined ('Cannot read properties of undefined (reading updateMany)' confirmé au 1er curl) et interdiction de redémarrer. Raw SQL = même table, mêmes sémantiques, fonctionne aussi après un futur restart (prisma stocke les DateTime SQLite en ISO-8601 texte, Comparisons/new Date() exacts ; INTEGER → BigInt converti via Number()). Aucun changement de schema ni de .env.
- AuthScreen.tsx (src/components/client) : état sentOtp (mock '123456') supprimé → demoCode (string|null). handleSendOtp : si data.demoMode → banner + setOtp(demoCode) (auto-fill), sinon setOtp('')/setDemoCode(null). Écran verify-otp : bannière ambre dismissible "Mode démo : SMS non configuré — votre code est XXXXXX" (icône Info déjà importée, croix de fermeture, aria-label) à la place du texte permanent "Code de test: 123456" ; placeholder input "123456" → "······". Tous les flux existants conservés (login PIN, inscription client/laveur INDEPENDANT/STATION, back navigation, resend timer 60s).
- Lint bunx eslint sur les 4 fichiers : 0 erreur / 0 warning.
- Tests curl (port 3000) : send-otp 90123456 → 200 {demoMode:true, demoCode:'139594'} ; renvoi immédiat → 429 ; phone 'abc' → 400 ; verify '000001' → 400 'Code invalide', '000002' → 400 (attempts=2 vérifié en DB) ; demoCode → 200 {success,user:{id cmo8v5kgm0005qdcjpdswcy5s…},token} + Set-Cookie socline_token HttpOnly ; même code re-soumis → 400 'Code expiré…' (one-time use) ; phone jetable 97112233 : 5 mauvais codes → 400, 6e essai avec le BON code → 400 'Trop de tentatives.' (lockout) ; aucun user créé (97112233 absent de users, client seed intact) ; lignes otp_codes de test supprimées après vérification (hash $2b$10$, attempts, consumedAt, expiry=createdAt+5min exacts). GET / → 200 (AuthScreen compile).

Stage Summary:
- Le mock OTP est mort : codes générés via node:crypto randomInt, stockés bcrypt-hashés dans otp_codes avec expiry 5 min, one-time use (consumedAt), max 5 tentatives, et jamais exposés dans les réponses API.
- Envoi SMS branché sur une abstraction 3 providers (Africa's Talking recommandé pour le Togo / Twilio / webhook HTTP générique) avec timeout 10s et erreurs non-fuite ; sans provider (état actuel), mode démo : bannière ambre dismissible dans l'UI + auto-fill, code toujours loggé serveur côté support.
- Rate limiting d'envoi en mémoire (1/60s puis 5/h par téléphone) → 429 avec messages FR ; messages d'erreur de vérification distincts (aucun code actif / expiré / trop de tentatives / code invalide) sans révéler la validité.
- ⚠️ Hors périmètre détecté à coordonner : /api/auth/register (l.39-54, utilisé par le flux d'INSCRIPTION de AuthScreen) accepte toujours UNIQUEMENT le code en dur '123456' — tant que cette route n'est pas migrée vers la table otp_codes (même pattern que verify-otp), l'inscription via l'UI échouera avec un vrai demoCode (le login par OTP, lui, est 100% fonctionnel). Fichier non touché (ownership).
- Point d'attention : la limite d'envoi est en mémoire → réinitialisée au restart du serveur ; pour la prod, prévoir Redis/DB (commentaire dans le code).

---
Task ID: 1-a
Agent: general-purpose
Task: Élimination IDOR — identité dérivée de la session (wallet, withdrawals, user/*, notifications, cars, addresses, conversations, washers/[userId], subscriptions/user GET, orders/[id]/payment)

Work Log:
- Lecture worklog.md, src/lib/auth.ts (requireAuth/requireAdmin/Session), prisma/schema.prisma (Washer.userId unique, Conversation.washerId = record Washer.id, Payment.orderId unique, WalletTransaction.orderId) + grep de tous les call sites frontend (WalletScreen, ClientOrderFlow, WasherApp, ClientSettings, CarsManager, NotificationCenter, ChatList, ChatView) pour confirmer que le frontend continue d'envoyer userId/washerId — désormais simplement ignorés côté serveur.
- 16 fichiers migrés vers `requireAuth(request)` (pattern `if (!auth.authorized) return auth.response!` puis `auth.user!.id`). Plus AUCUNE route ne lit userId/washerId du body/query pour l'identité ; 401 {success:false,error:'Non authentifié'} sans session (style propre à chaque route conservé).
- wallet/route.ts : GET (wallet session, query userId ignoré) ; POST (dépôt USSD, body userId ignoré) ; PUT (transaction scoped `wallet:{userId: session.id}`) ; PATCH durci intégralement : orderId seul requis, amount = order.totalPrice (body ignoré), order.clientId===session sinon 403, CANCELLED → 400, double-paiement (WalletTransaction PAYMENT/COMPLETED sur orderId OU Payment method WALLET/COMPLETED) → 400 'Cette commande a déjà été payée', puis $transaction unique (re-lecture wallet + garde solde throw→rollback, WalletTransaction PAYMENT/COMPLETED/balanceAfter, décrément balance/incrément totalSpent, Payment WALLET PENDING existant → COMPLETED dans la même tx). Réponse {success, transaction, wallet:{balance}} inchangée.
- withdrawals/route.ts : GET/POST → washer via `db.washer.findUnique({where:{userId:session.id}})` ; pas de washer → {success:true,withdrawals:[]} (GET) / 404 (POST) ; validations min 500, doublon PENDING, solde inchangées.
- user/profile (PUT) + user/activity (GET) : identité session ; validations PIN/téléphone et shapes inchangées (route profile n'a toujours que PUT — le PATCH name de WasherApp était déjà sans handler, hors périmètre).
- notifications (3 fichiers) : GET/read-all → session (création des notifications de bienvenue conservée) ; [id]/read → findFirst {id, userId: session} sinon 404 'Notification non trouvée'.
- cars + addresses + addresses/[id] : tous scoped session (GET/POST/PUT/DELETE) ; PUT/DELETE addresses/[id] et PUT/DELETE cars → findFirst {id, userId: session} sinon 404.
- conversations (3 fichiers) : helper washer record (`washer.findUnique({where:{userId}})`) pour la participation. GET : liste OR {clientId: session} / {washerId: washer.id} ; par orderId → participant requis (403 sinon), création auto uniquement si la commande existe ET session = client ou laveur assigné (clientId/washerId pris de la commande). POST : orderId requis, participant requis, clientId/washerId = valeurs de l'ordre (body ignoré). [id]/read : participant requis puis updateMany receiverId=session.id. [id]/messages (identity only) : GET participant requis ; POST → senderId = session.id, receiverId = l'autre participant résolu depuis la conversation (client→washer.userId / washer→clientId), body senderId/receiverId ignorés, verrou/shape conservés.
- washers/[userId] : requireAuth puis session.id === param.userId OU role ADMIN, sinon 403 (WasherApp l'appelle avec son propre user.id → OK).
- subscriptions/user : GET → session (query userId ignoré, includeHistory conservé) ; POST → uniquement remplacement du userId body par session.id (structure de la transaction Issue 5-a inchangée) ; PATCH non touché.
- orders/[id]/payment : POST → requireAuth, userId = session.id, amount = order.totalPrice (body ignoré), method normalisée CASH|WALLET (défaut CASH), early-return 'Paiement déjà enregistré' conservé, client propriétaire requis (403) ; GET → requireAuth + accès client de la commande OU laveur assigné (record Washer) OU ADMIN, sinon 403, 404 sans paiement.
- Tests curl (cookies client 90123456 / laveur 90234567 / admin 71998155) : 24 requêtes sans cookie → toutes 401. Flux légitimes 200 : wallet GET (propriétaire, y compris avec ?userId=<autre> → renvoie bien SON wallet), withdrawals GET laveur, user/activity, notifications (+read-all), cars, addresses, subscriptions/user, conversations liste laveur (n=2 via record Washer) et par orderId, messages conversation propre, washers/[self] (laveur+admin), payment GET laveur assigné + admin. IDOR → 403/404 : notification étrangère 404, washers/[autre] 403, messages/mark-read/send conversation étrangère 403, conversation par orderId étranger 403, payment GET/POST commande étrangère 403 (laveur non assigné aussi 403), wallet PATCH commande étrangère 403 / inexistante 404 / propre sans solde → 400 Solde insuffisant required=2000 (prouve amount=order.totalPrice, body amount=1 ignoré), wallet PUT transaction étrangère 404, address/car étrangers PUT+DELETE 404. Aucune donnée seed mutée (aucun paiement réel, aucun retrait créé).
- Lint bunx eslint sur les 16 fichiers : 0 erreur / 0 warning. tsc --noEmit : 24 erreurs = count identique au pré-existant (Task 5-a) ; l'unique hit dans un fichier modifié (subscriptions/user l.266 `plan.service`) est l'erreur connue du PATCH non modifié (décalage de ligne seulement).

Stage Summary:
- IDOR éliminé sur les 16 routes du périmètre : l'identité vient exclusivement du cookie JWT signé (requireAuth) ; userId/washerId/amount envoyés par le client sont ignorés. Sans session → 401 ; ressource d'autrui → 403 (conversations, washers/[userId], payment, wallet PATCH non-propriétaire) ou 404 (notifications/[id], addresses/[id], cars, wallet PUT transaction étrangère).
- PATCH /api/wallet désormais sûr : montant serveur (order.totalPrice), garde propriétaire + statut, anti double-paiement, débit atomique $transaction avec garde solde et complétion du Payment WALLET PENDING.
- conversations : la participation est vérifiée via le record Washer (conversation.washerId ≠ User.id) côté GET par orderId, liste, read et messages ; sender/receiver d'un message toujours dérivés de la conversation.
- Contrats d'API conservés (aucun call site frontend à modifier) ; lint propre ; serveur compile et répond ; 24 erreurs tsc pré-existantes inchangées.
- Hors périmètre signalés : GET /api/orders (tache dédiée), PATCH /api/user/profile absent (WasherApp 'Modifier le profil' → 405 pré-existant), PIN toujours stocké en clair comparé (`user.pin !== currentPin`).
---
Task ID: 1-c
Agent: general-purpose
Task: Auth socket chat — JWT au handshake, identité forcée côté serveur, endpoint interne /internal/emit sécurisé, ChatView envoie le token

Work Log:
- Port 3003 vérifié libre avant démarrage (`ss -tln` vide). mini-services/washgo-socket non touché, non démarré.
- Deps : `bun add jsonwebtoken` + `bun add -d @types/jsonwebtoken` dans mini-services/chat-service (installation OK, aucun conflit).
- mini-services/chat-service/index.ts réécrit :
  * `loadRootEnv()` : lit `../../.env` (relatif à import.meta.dir → /home/z/my-project/.env) avec fs.readFileSync, parse KEY=VALUE (lignes # ignorées, quotes stripées) et ne renseigne process.env QUE pour les clés absentes. Appelé avant tout usage de JWT_SECRET / INTERNAL_SOCKET_SECRET. Warnings au boot si secret manquant (fail-safe : handshake rejeté / 403).
  * Middleware de handshake `io.use` : token lu dans socket.handshake.auth.token, jwt.verify HS256 avec JWT_SECRET, payload.userId requis → socket.data.userId ; sinon next(new Error('unauthorized')) (token absent/invalide/payload vide).
  * Identité forcée sur tous les events : 'join' ignore le payload (userId = socket.data.userId, 'connected' emit + connectedUsers + room user:<id> conservés) ; 'send-message' force senderId = JWT (data.senderId ignoré) ; 'typing'/'stop-typing'/'mark-read' forcent userId (emits user-typing/user-stop-typing/messages-read avec readBy=JWT) ; handler 'location-update' SUPPRIMÉ (broadcast de fausses positions) ; 'join-conversation'/'leave-conversation'/'join-order-tracking' inchangés ; CORS + port 3003 + prefixes [Chat] conservés.
  * Endpoint interne POST /internal/emit sur le même http server que socket.io : le listener 'request' est enregistré AVANT l'attachement de io() pour qu'engine.io lui transmette les requêtes non /socket.io (pattern officiel d'attach). Contrat : header x-internal-secret === INTERNAL_SOCKET_SECRET (sinon 403 {error:'forbidden'}), body JSON {rooms:string[], event:string, data:unknown} (sinon 400 {error:'invalid body'}), émet io.to(room).emit(event,data) pour chaque room → 200 {ok:true} ; autres méthodes/paths → 404 ; lecture du body via reader async chunk (limite 64 Ko) ; logs sans contenu des messages (event + nb rooms seulement) ; erreurs HTTP internes 500 silencieuses sur socket morte.
- src/components/chat/ChatView.tsx (uniquement la partie socket) : import { toast } from 'sonner' ajouté ; initSocket lit useAuthStore.getState().token (hors deps du useEffect volontairement) ; pas de token → pas de connexion, setConnected(false), toast 'Session expirée, veuillez vous reconnecter' ; io('/?XTransformPort=3003', { transports:['websocket'], reconnection:true, auth:{ token } }) ; 'join' émis sans payload (identité côté serveur) ; nouveau handler 'connect_error' : log + toast 'Session expirée…' si message 'unauthorized' avec garde anti-spam (flag par montage, réarmé au reconnect réussi). Le reste du fichier inchangé.
- Service démarré : `bun --hot mini-services/chat-service/index.ts` → log [Chat Service] Running on port 3003. NOTE INFRA : un simple `nohup … &` (même avec setsid) est tué par le sandbox à la fin de la commande Bash ; la variante double-fork `( setsid bun --hot … > log 2>&1 < /dev/null & )` persiste entre commandes (pid 8953, session leader). À réutiliser pour les prochaines tâches.
- Script de vérification temporaire (socktest.ts, supprimé après) exécuté avec bun depuis /home/z/my-project (env auto-chargée) :
  * T1 sans token → connect_error 'unauthorized' ✅
  * T2 token forgé (mauvais secret) → 'unauthorized' ✅
  * T3 token valide (login client 90123456/1234 via POST /api/auth/login, payload {success,user,token}) → event 'connected' {userId, status:'online'} avec le bon userId ✅
  * T4 deux clients valides (client + laveur 90234567) : send-message du client avec senderId = id du LAVEUR (usurpation) → le laveur reçoit 'new-message' avec senderId FORCÉ = id client ✅
  * T5 /internal/emit : sans secret 403 ; mauvais secret 403 ; body invalide 400 ; path inconnu 404 ; appel valide (rooms:[user:<client>], event 'test:ping') → 200 {ok:true} ET le socket client connecté reçoit bien test:ping {hello:true} ✅
  * T6 gateway : la Caddy du sandbox (port 81) proxifie /socket.io/?XTransformPort=3003 → handshake polling 0{"sid":…} + connexion websocket COMPLÈTE avec auth JWT à travers le gateway → 'connected' avec le bon userId ; log du service montre les connexions/upgrade. URL/pattern du frontend inchangés.
- Bunx eslint src/components/chat/ChatView.tsx : 0 erreur / 0 warning. Nettoyage : scripts temporaires supprimés.

Stage Summary:
- Le mini-service chat (port 3003) n'accepte plus aucune connexion sans JWT HS256 valide signé avec JWT_SECRET ; l'identité (userId) vient exclusivement du token au handshake et est réinjectée serveur sur join/send-message/typing/stop-typing/mark-read — impossible de se faire passer pour un autre utilisateur, même en falsifiant les payloads.
- 'location-update' supprimé : plus de broadcast de fausses positions par les clients (remplacera plus tard par un push API serveur-à-serveur).
- Contrat /internal/emit (pour l'agent suivant) : POST http://localhost:3003/internal/emit, header x-internal-secret: $INTERNAL_SOCKET_SECRET (.env racine), body {"rooms":["user:<userId>"|"conversation:<id>"|"order:<id>"],"event":"<nom>","data":<any>} → 200 {ok:true} et émission io.to(room).emit(event,data) par room ; 403 si secret absent/mauvais, 400 si body invalide, 404 sinon ; le Next.js API devra l'appeler depuis le serveur uniquement (secret jamais exposé au client).
- ChatView passe le token zustand dans auth:{token} au handshake, n'initialise pas la connexion sans token et affiche un toast sonner anti-spam 'Session expirée, veuillez vous reconnecter' sur les refus unauthorized ; 'join' n'envoie plus d'userId (ignoré de toute façon).
- Tests 1→6 tous PASS, lint 0 erreur, service RUNNING (pid 8953, log /home/z/my-project/chat-service.log), aucun commit/push.
---
Task ID: 3
Agent: general-purpose
Task: Tracking temps réel réel — émits socket depuis les API (order:updated, washer-location), state machine + auth sur PATCH orders, endpoint location laveur, OrderTracking branché socket+poll avec vraies données, WasherApp partage GPS

Work Log:
- src/lib/realtime.ts (nouveau) : emitRealtime(rooms, event, data) — fire-and-forget POST http://127.0.0.1:3003/internal/emit, header x-internal-secret depuis process.env.INTERNAL_SOCKET_SECRET, AbortController 3 s, catch + console.error '[Realtime] emit failed:', ne jette jamais, ne bloque jamais la réponse API.
- PATCH /api/orders (src/app/api/orders/route.ts, SEUL le PATCH + import emitRealtime — GET/POST Task 2 inchangés octet pour octet) :
  * requireAuth (401 sans session), body {orderId, status, washerId?, cancelReason?} — orderId requis 400, status validé contre l'enum 400.
  * Chargement de la commande avec client + washer.user + service.
  * Autorisations : WASHER résout son record (`db.washer.findFirst({ OR: [{id}, {userId}] })`) — peut ACCEPTER une PENDING (auto-assignation washerId = washer.id, body washerId IGNORÉ sauf admin) et faire avancer ses propres commandes ; annulation laveur de ses commandes ACCEPTED/EN_ROUTE avec raison forcée 'Annulée par le laveur' ; sinon 403. CLIENT : uniquement CANCELLED sur SA commande et seulement PENDING/ACCEPTED, raison = body ou 'Annulée par le client' ; sinon 403. ADMIN : toute transition valide sur toute commande (+ peut (ré)assigner un washerId résolu record, héritage du comportement admin).
  * Machine à états : PENDING→ACCEPTED|CANCELLED, ACCEPTED→EN_ROUTE|CANCELLED, EN_ROUTE→ARRIVED|CANCELLED, ARRIVED→IN_PROGRESS, IN_PROGRESS→COMPLETED, COMPLETED/CANCELLED terminaux → sinon 400 'Transition de statut invalide'. Répétition du MÊME statut = idempotente → 200 avec la commande inchangée, AUCUN effet de bord (vérifié avant la matrice, après l'autorisation).
  * Timestamps : ACCEPTED→acceptedAt, EN_ROUTE→startedAt, ARRIVED→arrivedAt, COMPLETED→completedAt, CANCELLED→cancelledAt+cancelReason (IN_PROGRESS : pas de champ dédié, arrivedAt conservé).
  * Logique métier conservée : recalcul commission au niveau partenaire à ACCEPTED (Article 5), crédit laveur à COMPLETED dans $transaction (totalEarnings += totalPrice − commission clampé ≥ 0, completedJobs +1, anti double-crédit), création conversation à ACCEPTED.
  * Après transaction/conversation OK : emitRealtime(['order:<id>', 'user:<clientId>', 'user:<washerUserId>' si présent], 'order:updated', order complet avec washer{user} + service).
- PATCH /api/orders/[id] : même durcissement (requireAuth, même matrice, mêmes règles de rôle, mêmes timestamps, même idempotence), conservation de ses spécificités : création TrackingEvent à chaque transition, crédit laveur en $transaction, formes de réponse {success:false,error} d'origine, création conversation à ACCEPTED (parité), emit 'order:updated' identique.
- src/app/api/orders/[id]/location (nouveau, POST) : requireAuth + rôle WASHER + résolution record Washer ; validation {latitude, longitude} nombres finis dans [-90,90]/[-180,180] sinon 400 ; commande 404, washerId ≠ washer.id → 403, statut hors ACCEPTED/EN_ROUTE/ARRIVED → 400 ; persiste TrackingEvent {event:'WASHER_LOCATION', latitude, longitude, message:null} ; housekeeping : ne garde que les 50 derniers points (deleteMany createdAt < 51ᵉ plus récente) ; emitRealtime(['order:<id>'], 'washer-location', {orderId, latitude, longitude, timestamp ISO}) ; répond {success:true}.
- src/components/client/OrderTracking.tsx : TOUTE la simulation supprimée (setInterval déplacement, setTimeout de progression, countdown estimé, position par défaut codée en dur). Socket au montage : import dynamique io, token useAuthStore.getState().token, io('/?XTransformPort=3003', {transports:['websocket'], reconnection:true, auth:{token}}), au connect → emit('join-order-tracking', order.id) ; 'order:updated' → setCurrentOrder(payload)+updateOrder(payload) (gardes payload.id === order.id) ; 'washer-location' → setWasherLocation({lat, lng, at}) ; déconnexion au démontage/changement de commande. Polling de secours 15 s → GET /api/orders/<id> ({success, order}), ne touche le store que si le statut diffère. Carte laveur = vraies données (initiales du nom, user.name, rating.toFixed(1), 'X lavages'), cachée tant que pas de laveur (règle status !== 'PENDING' conservée + garde null). Placeholder carte : 'Position du laveur mise à jour à HH:MM' + coordonnées 5 décimales quand une position réelle existe, 'En attente de la position du laveur…' si EN_ROUTE sans position. ETA réel uniquement si washerLocation && order.latitude/longitude : haversine ÷ 25 km/h → 'Arrivée estimée ~X min' (min 1). Pastilles horaires subtiles 'Acceptée à/Départ à/Terminée à HH:MM' (fr-FR) sous le badge. Bouton Annuler (PENDING/ACCEPTED) → PATCH /api/orders {orderId, status:'CANCELLED'} avec état de chargement, toast.error sonner sur échec. Écran COMPLETED + notation inchangés.
- src/components/washer/WasherApp.tsx (uniquement : GPS + refresh temps réel + badge) : useEffect partage GPS quand commande assignée EN_ROUTE/ARRIVED → navigator.geolocation.watchPosition({enableHighAccuracy:true}) + un fix immédiat au démarrage (getCurrentPosition forcé), POST /api/orders/<id>/location throttlé à 1/10 s (ref lastLocationSentRef), nettoyage clearWatch au changement de statut/démontage, échecs silencieux console.warn, après 3 échecs consécutifs clearWatch + locationSharing:false ; état locationSharing + pastille 'Position partagée' (point vert pulsant animate-ping) dans ActiveOrderView à côté des actions. Socket au montage (même pattern ChatView : import dynamique + token zustand) → sur 'order:updated' relance fetchPendingOrders()+fetchMyOrders() existantes via ref (pas de logique fetch dupliquée). Aucun autre comportement modifié (disponibilité, retraits, profil, station…).
- Tests (curl, cookies client 90123456 / laveur 90234567 / admin 71998155) : commande test créée POST /api/orders (Lavage Essentiel, 'Test tracking') → PENDING 2500 XOF commission 1000.
  * Auth : sans cookie PATCH → 401 ; client tente ACCEPTED → 403 ; laveur tente EN_ROUTE sur commande non à lui → 403 ; status invalide 'FLYING' → 400 ; client tente EN_ROUTE via PATCH [id] → 403 ; PATCH [id] sans cookie → 401.
  * Transitions laveur : PENDING→ACCEPTED (body washerId hostile = id client IGNORÉ, auto-assign record cmo8v5kgq…, acceptedAt posé, réponse inclut washer 'Laveur Test', commission recalculée) ; répétition ACCEPTED → 200 idempotent inchangé ; →EN_ROUTE (startedAt) ; ACCEPTED sur commande EN_ROUTE → 400 'Transition de statut invalide' ; →ARRIVED (arrivedAt) ; →IN_PROGRESS ; →COMPLETED (completedAt) ; crédit laveur vérifié avant/après GET /api/washers/<userId> : totalEarnings 22775→24275 (+1500 = 2500−1000), completedJobs 2→3 ; répétition COMPLETED → 200 sans double crédit (24275/3 confirmé).
  * Location : client → 403 ; lat 95 → 400 ; laveur pendant EN_ROUTE → 200, ligne TrackingEvent WASHER_LOCATION vérifiée par script bun prisma (message null) ; pendant ARRIVED → 200 ; pendant COMPLETED → 400 ; log chat-service 'Internal emit: event=washer-location rooms=1'.
  * Client annule sa PENDING → CANCELLED + cancelledAt + cancelReason 'Test annulation client' ; admin : PENDING→ACCEPTED (sans laveur) puis CANCELLED OK.
  * E2E temps réel (script bun socket.io-client, token JWT client depuis login, emit 'join-order-tracking' sur la commande) : PATCH laveur EN_ROUTE → le client reçoit 'order:updated' {status:'EN_ROUTE', acceptedAt, washerName:'Laveur Test', service:'Lavage Essentiel'} ; POST location → 'washer-location' {orderId, latitude:14.72, longitude:-17.47, timestamp}. Sortie script : SOCKET_CONNECTED / JOINED_ORDER / RECEIVED order:updated / RECEIVED washer-location.
  * Lint bunx eslint sur les 5 fichiers possédés : 0 erreur 0 warning. Page d'accueil 200.
- Nettoyage : 4 commandes test supprimées (+ tracking events + conversations en cascade), 0 ordre 'Test tracking' restant ; scripts temporaires (realtime-e2e-tmp.ts, check-tracking-tmp.ts, check-o4-tmp.ts, cleanup-tmp.ts) supprimés.

Stage Summary:
- Le suivi de commande est désormais RÉEL : toute transition validée par l'API émet 'order:updated' dans les rooms order:<id>, user:<client> et user:<laveur> via /internal/emit sécurisé ; l'écran client se met à jour en direct (socket + polling 15 s de secours) avec le vrai laveur, les vrais horodatages et une ETA haversine basée sur la position GPS réelle du laveur.
- PATCH /api/orders et PATCH /api/orders/[id] sont désormais authentifiés (401/403), avec machine à états complète (transitions invalides 400, terminaux verrouillés, répétition idempotente sans double effet), auto-assignation laveur sécurisée (body washerId ignoré sauf admin), timestamps par statut, et conservation intégrale de la logique métier (commission Article 5, crédit laveur anti double-crédit, conversation, tracking event sur [id]).
- Nouveau POST /api/orders/[id]/location : seul le laveur assigné peut pousser sa position pendant ACCEPTED/EN_ROUTE/ARRIVED ; point persisté (TrackingEvent, 50 max/commande) et poussé en temps réel 'washer-location' à la room commande ; WasherApp partage le GPS (watchPosition, 1 push/10 s, stop après 3 échecs) avec pastille 'Position partagée' et rafraîchit ses listes sur 'order:updated'.
- Tests : matrice complète PASS (401/403/400/200 + idempotence + crédit laveur 22775→24275, completedJobs 2→3 conservés sur le compte de démo), E2E socket order:updated + washer-location PASS, lint 0/0, commandes et scripts de test supprimés, service 3003 intact, aucun commit/push.

---
Task ID: 4 (session 5 FIXS SÉCURITÉ/TEMPS RÉEL)
Agent: main (Z.ai Code) + subagents 1-a/1-b/1-c/3
Task: 5 améliorations demandées — IDOR généralisé, prix pilotés serveur, tracking temps réel réel, OTP sans code dans la réponse (+vrai SMS), auth socket chat

Work Log:
- Préparation: modèle OtpCode (schema + db:push), .env (INTERNAL_SOCKET_SECRET, placeholders SMS_*), exploration routes/services
- 1-a (subagent, parallèle): IDOR — 16 routes passées en identité session (wallet GET/POST/PUT/PATCH avec paiement transactionnel + garde double-paiement, withdrawals, user/*, notifications ×3, cars, addresses ×2, conversations ×3 (participant = clientId OU record Washer), washers/[userId] self|admin, subscriptions/user GET, orders/[id]/payment). 24/24 → 401 sans cookie; IDOR → 403/404. Lint 0/0.
- 1-b (subagent, parallèle): OTP réel — send-otp (crypto-random, bcrypt, 5 min, rate-limit 1/60s + 5/h, jamais dans la réponse sauf demoMode), verify-otp (attempts max 5, one-time), lib/sms.ts (africastalking/twilio/http). Suivi main: /api/auth/register durci via src/lib/otp.ts partagé (fini le 123456 en dur); testé curl + navigateur (bannière Mode démo + auto-fill + inscription complète). NOTE: accès OTP en $queryRaw (serveur lancé avant prisma generate → delegate absent; OK après restart aussi).
- 1-c (subagent, parallèle): chat-service — JWT HS256 obligatoire au handshake (auth.token), identité forcée côté serveur sur join/send-message/typing/mark-read, 'location-update' client supprimé, POST /internal/emit (x-internal-secret). ChatView envoie le token; connect_error → toast. Service démarré port 3003 (pid changeant; persistance via double-fork setsid). Tests: sans/forgé/valide token, identité forcée, internal emit 403/200, gateway OK.
- 2 (main): prix serveur — lib/promo.ts partagée; POST /api/orders (clientId session, totalPrice/discount/commission recalculés, promo revalidée + maxUsesPerUser via historique); GET /api/orders session-based (+FIX: record Washer résolu au lieu du User.id → listes laveur qui marchent); promotions/validate session. Curl: prix forgé 999999 → 2500; TESTPRIX 20% → 2000; réutilisation → 400.
- 3 (subagent): tracking réel — lib/realtime.ts (emit interne), PATCH orders + [id] : requireAuth + machine à états + timestamps + idempotence + émits order:updated; POST /api/orders/[id]/location (laveur propriétaire, EN_ROUTE/ARRIVED, TrackingEvent + housekeeping, émit washer-location); OrderTracking 100% dé-simulé (socket + poll 15s, vraie carte laveur, ETA haversine, annulation fonctionnelle); WasherApp partage GPS (watchPosition, 1 POST/10s) + badge + refresh listes. Testé curl + script socket E2E.
- 4 (main): vérif navigateur via gateway :81 — IMPORTANT: agent-browser sur :3000 contourne Caddy → XTransformPort non réécrit → socket muet (artefact de test, PAS un bug; le preview utilisateur passe par Caddy). Via :81: login client → commande UI → tracking PENDING sans auto-progression (9s+) → acceptation laveur curl → UI "Acceptée à" + vraie carte laveur en <2s (socket) → EN_ROUTE → POST location → "Position du laveur mise à jour à HH:MM" + ETA → ARRIVED/IN_PROGRESS/COMPLETED → écran terminé + note. Flux inscription OTP complet vérifié (bannière démo, auto-fill, compte créé puis nettoyé). Données de test créées puis supprimées (2 commandes test gardées: WG63577322 COMPLETED + une acceptée — compteur laveur 3 lavages).

Stage Summary:
- Commits: 317384d (IDOR) → e7bdc28 (OTP) → 191096c (socket chat) → b1f1b55 (prix serveur) → c2d9a69 (tracking réel)
- Aucune réponse API n'expose plus de code OTP (hors demoMode sans provider) ni ne fait confiance à une identité client
- Le client paie toujours le prix calculé serveur; le suivi est branché DB + sockets avec fallback polling
- Pour activer le SMS réel: décommenter SMS_PROVIDER/SMS_API_KEY/SMS_USERNAME dans .env (demoMode disparaît automatiquement)
- Restants (non demandés): IDOR-similaire sur /api/auth/mobile/* (JWT Bearer mobile), messages chat non persistés via socket (DB seulement via API), /api/seed réactive les promos expirées, PIN user.profile comparé en clair (route sans handler PATCH: profil laveur 405)

---
Task ID: 5 (session 6 — SMS Africa's Talking)
Agent: main (Z.ai Code)
Task: L'utilisateur a fourni sa clé API Africa's Talking (atsk_…) → configurer le SMS réel pour l'OTP

Work Log:
- Testé la clé contre l'API AT avec username=sandbox → HTTP 401 "The supplied authentication is invalid" → c'est une CLÉ DE PRODUCTION (pas sandbox); il manque le SMS_USERNAME (username choisi à l'inscription) pour l'activer.
- .env (gitignored): SMS_PROVIDER=africastalking + SMS_API_KEY=atsk_… + SMS_SENDER_ID=SOCLINE + SMS_DEMO_FALLBACK=true; SMS_USERNAME laissé commenté en attendant la valeur.
- send-otp: ajout du fallback SMS_DEMO_FALLBACK=true → si provider configuré mais envoi échoué (crédit 0, numéro non joignable), le code est exposé en mode démo (bannière + auto-fill) au lieu de renvoyer smsSent:false sans code (qui bloquerait l'inscription dans le preview). À passer à false en production.
- lib/sms.ts: doc de SMS_DEMO_FALLBACK dans l'en-tête.
- Vérifié: hot-reload .env par le dev server (pas de restart nécessaire); fallback démo (demoCode + smsSent:false via username factice); mode démo pur (username commenté); verify-otp accepte le bon code / rejette "000000" ("Code invalide"); flux inscription complet au navigateur (bannière "Masquer le code de démo", OTP auto-rempli 626493, compte créé → écran client).
- Nettoyage: comptes de test +22891111111 / 93333333 et lignes otp_codes supprimés (bun -e + PrismaClient). Lint 0/0.
- Commit 9a2811e → push origin main (seuls sms.ts + send-otp/route.ts committés; .env jamais committé).

Stage Summary:
- Le SMS réel ne s'activera qu'avec SMS_USERNAME (username du compte AT de l'utilisateur) — décommenter la ligne 19 de .env; hot-reload le prend en compte sans restart.
- Compte AT production requis avec du crédit (recharge mobile money/carte); tarif Togo ≈ 8–13 F CFA/SMS.
- SMS_DEMO_FALLBACK=true actuellement pour la démo — À DÉSACTIVER avant mise en production réelle.
