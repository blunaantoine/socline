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
