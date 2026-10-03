# 🚀 Déployer Socline sur Vercel (démo)

> **Objectif** : mettre Socline en ligne en mode **démo** (pas production) sur Vercel,
> avec une vraie base de données distante. Temps de mise en place : ~15 minutes.

---

## 0. Ce qui change en mode démo Vercel

| Élément | Local (sandbox) | Vercel (démo) |
|---|---|---|
| Base de données | SQLite fichier (`db/custom.db`) | **Turso** (libSQL distant, gratuit) — le filesystem Vercel est éphémère, un fichier SQLite y serait effacé |
| Temps réel (socket) | mini-service `chat-service` port 3003 | **Désactivé** (`NEXT_PUBLIC_ENABLE_SOCKET=false`) — les serverless Vercel ne peuvent pas héberger un socket persistant. L'app repasse sur ses filets de polling (notifications 30 s, commandes laveur 10 s, portefeuille 8 s…) |
| Notifications | in-app + toast **temps réel socket** | in-app + polling (30 s) — pas de socket persistant possible sur serverless |
| SMS / OTP | Africa's Talking si configuré | idem (optionnel — clés à recopier) |

L'application détecte tout automatiquement : aucune modification de code n'est nécessaire
entre le local et Vercel.

---

## 1. Base de données : créer une DB Turso (gratuit)

1. Créer un compte sur **https://turso.tech** (connexion GitHub possible).
2. Installer la CLI (ou tout faire dans le dashboard web) :
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth signup     # ou turso auth login
   turso db create socline-demo --location fra   # Paris ; ou iad, etc.
   turso db show socline-demo --url        # → TURSO_DATABASE_URL
   turso db tokens create socline-demo     # → TURSO_AUTH_TOKEN
   ```
3. **Pousser le schéma Prisma** vers Turso (depuis la racine du projet) :
   ```bash
   DATABASE_URL="libsql://<db>-<user>.turso.io?authToken=<TOKEN>" bunx prisma db push
   ```
   > Remplacez `<db>-<user>.turso.io` et `<TOKEN>` par les valeurs obtenues à l'étape 2.
   > La commande affiche « Your database is now in sync with your schema. »
4. Notez les deux valeurs, elles serviront dans Vercel :
   - `TURSO_DATABASE_URL` = `libsql://…turso.io` (SANS le `?authToken=`)
   - `TURSO_AUTH_TOKEN` = le token

---

## 2. Déployer sur Vercel

1. Créer un compte sur **https://vercel.com** (connexion GitHub).
2. **Add New… → Project** → importer le repo **blunaantoine/socline**.
3. Framework Preset : **Next.js** (détecté automatiquement — ne rien changer
   aux commandes de build/install).
4. Avant de cliquer sur *Deploy*, ouvrir **Environment Variables** et ajouter :

   | Variable | Valeur | Obligatoire |
   |---|---|---|
   | `DATABASE_URL` | `file:/tmp/custom.db` (secours, rarement utilisé) | ✅ |
   | `TURSO_DATABASE_URL` | `libsql://…turso.io` | ✅ |
   | `TURSO_AUTH_TOKEN` | token Turso | ✅ |
   | `JWT_SECRET` | une longue chaîne aléatoire **différente** du défaut | ✅ |
   | `JWT_REFRESH_SECRET` | une autre longue chaîne aléatoire | ✅ |
   | `INTERNAL_SOCKET_SECRET` | une autre longue chaîne aléatoire | ✅ |
   | `NEXT_PUBLIC_ENABLE_SOCKET` | `false` | ✅ |
   | `SMS_PROVIDER`, `SMS_USERNAME`, `SMS_API_KEY`, `SMS_DEMO_FALLBACK=true` | compte Africa's Talking | ⬜ (SMS) |

   > 💡 Générer une chaîne aléatoire : `openssl rand -hex 32`
5. Cliquer **Deploy**. Le build exécute `prisma generate` automatiquement
   (script `postinstall`) puis `next build`.
6. À la fin, Vercel affiche l'URL du style `https://socline-xxx.vercel.app`.

> ⚠️ Les variables `NEXT_PUBLIC_*` sont lues **au build** : si vous les ajoutez
> après coup, faites **Redeploy** pour qu'elles soient prises en compte.

---

## 3. Peupler la base de démo

La DB Turso est vide au départ. Un seul appel crée les services, les comptes
de démonstration et les plans d'abonnement :

```bash
curl -X POST https://socline-xxx.vercel.app/api/seed
```

Comptes de démo créés (PIN `1234`) :

| Rôle | Téléphone | PIN |
|---|---|---|
| Client | `90123456` | `1234` |
| Laveur | `90234567` | `1234` |
| Admin | `71998155` | `1234` |

---

## 4. Notifications en mode démo Vercel

Le système de notifications est **in-app** : tout est enregistré en base
(`GET /api/notifications`) et affiché dans la cloche de chaque profil
(client, laveur, admin) :

- **Local (sandbox)** : les alertes arrivent **instantanément** via le socket
  temps réel (`chat-service`, port 3003).
- **Vercel (démo)** : le socket étant désactivé, les notifications sont
  récupérées par **polling (30 s)** — la cloche et son badge de non-lues
  fonctionnent à l'identique, avec une latence de ~30 s maximum.
- **SMS** : les événements critiques (dépôt validé, retrait approuvé/refusé…)
  envoient aussi un SMS best-effort via Africa's Talking si les clés sont
  configurées.

Aucune configuration supplémentaire n'est nécessaire.

---

## 5. Limitations connues du mode démo

- **DB démo partagée** : Turso free tier suffit largement pour une démo, mais
  ne pas y stocker de données sensibles réelles.
- **Pas de temps réel socket** : les statuts (dépôt/retrait/commande) et les
  notifications se rafraîchissent par polling (8–30 s selon l'écran).
- **SMS/OTP** : sans crédits Africa's Talking configurés, l'OTP retombe en mode
  démo (`SMS_DEMO_FALLBACK=true`).
- **Fichiers uploadés** (photos chat…) : non persistants sur Vercel serverless.
- Pour passer en **production** plus tard : Turso payant ou Postgres managé,
  stockage objet (S3/R2), WebSocket dédié (Railway/Fly), monitoring.

---

## 6. Dépannage

| Symptôme | Cause probable |
|---|---|
| `Invalid env var` au build | une variable obligatoire manque dans Vercel |
| Erreur Prisma « Timed out fetching connection » | `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` incorrects |
| Login impossible après redeploy | `JWT_SECRET` a changé entre deux deploys → les sessions anciennes sont invalides, se reconnecter |
