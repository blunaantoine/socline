# Socline Mobile - Guide de développement et de publication

## 📱 Architecture : MODE SERVEUR DISTANT

L'application mobile Socline est une **enveloppe native Capacitor** qui charge
directement l'application web hébergée sur le serveur :

```
┌──────────────────────────────────────────────┐
│  APPLICATION MOBILE (Android / iOS)          │
│  WebView → https://socline.oquitogo.com      │
│  + plugins natifs Capacitor injectés :       │
│    caméra, GPS, push, haptique, splash…      │
└────────────────────┬─────────────────────────┘
                     │ HTTPS (même origine)
                     ▼
┌──────────────────────────────────────────────┐
│  SERVEUR socline.oquitogo.com (VPS)          │
│  Next.js : interface + ~60 routes API        │
│  Auth JWT · SQLite/Prisma · Socket.io ×2     │
│  (chat :3003 · suivi laveur :3005 via        │
│   ?XTransformPort=, routés par nginx)        │
└──────────────────────────────────────────────┘
```

### Pourquoi ce mode ?

L'application contient des **routes API Next.js dynamiques** (`/api/...`) qui
**ne peuvent pas** être exportées en statique (`output: 'export'` échoue).
Plutôt que de dupliquer le backend, la WebView mobile charge le site distant :
même interface, même authentification, mêmes sockets — **zéro divergence**.

### ✅ Conséquence : mises à jour automatiques

Toute évolution déployée sur `https://socline.oquitogo.com` (via
`deploy.sh --update`) est **immédiatement visible dans l'application mobile**,
**sans nouvelle version APK**. Une nouvelle APK n'est nécessaire que pour :
- modifier les plugins natifs / permissions ;
- changer l'icône, le splash ou la version affichée ;
- publier une nouvelle version sur les stores.

## 🚀 Commandes

```bash
npm run mobile:sync         # Synchronise la config + plugins vers android/ et ios/
npm run mobile:android      # Ouvre le projet dans Android Studio
npm run mobile:ios          # Ouvre le projet dans Xcode (macOS uniquement)
npm run mobile:run:android  # Lance sur un appareil/émulateur Android
npm run mobile:run:ios      # Lance sur un simulateur iOS (macOS)
npm run mobile:build        # (informatif) plus aucun build Next requis
```

> ⚠️ `mobile:build` ne compile plus rien : en mode serveur distant, la WebView
> charge le site — un export statique Next échouerait à cause des routes API.

### Développement contre un serveur local (optionnel)

```bash
# Pointe la WebView vers une machine de dev (auto-reload, debug WebView activé)
CAPACITOR_DEV_SERVER_URL=http://192.168.1.50:3000 npx cap run android
# puis bun run dev sur la machine de dev
```

## 🛠️ État du projet (pré-configuré)

| Élément | État |
|---|---|
| `capacitor.config.ts` | ✅ Mode serveur distant (`server.url: https://socline.oquitogo.com`) |
| `appId` / `appName` | ✅ `com.socline.app` / `Socline` |
| `android/` | ✅ Projet natif généré et commité |
| `ios/` | ✅ Projet natif généré et commité (build nécessite un Mac) |
| `mobile-shell/` | ✅ Page de secours brandée embarquée dans l'APK |
| Plugins (8) | ✅ camera · geolocation · haptics · network · preferences · push · splash · status-bar |
| Couche utilitaire | ✅ `src/lib/mobile/index.ts` + `src/hooks/useMobileAuth.ts` |
| Push (FCM/APNs) | ⬜ À configurer (Firebase + Apple) avant d'activer réellement |

### Après un `git pull` sur une nouvelle machine

```bash
npm install          # ou bun install
npx cap sync         # resynchronise plugins + config dans les projets natifs
```

## 🪟 Préparation sur Windows (sans WSL)

1. **Node.js** : installer depuis https://nodejs.org (LTS). Si `npm` n'est pas
   reconnu dans un terminal déjà ouvert, corriger le PATH de la session :
   ```bat
   set "PATH=C:\Program Files\nodejs;%PATH%"
   node --version
   ```
2. **Android Studio** : https://developer.android.com/studio
   (installe SDK + émulateur ; accepter les licences).
3. À la racine du projet :
   ```bat
   npm install
   npx cap sync
   npm run mobile:android
   ```
4. Dans Android Studio : **Build → Generate Signed App Bundle / APK**.

## 🏪 Publication — Google Play Store

1. **Compte** Google Play Console (25 $ unique) : https://play.google.com/console
2. **Keystore de signature** (à conserver précieusement, perte = impossible de
   mettre à jour l'app) :
   ```bat
   keytool -genkey -v -keystore socline-release.keystore -alias socline ^
     -keyalg RSA -keysize 2048 -validity 10000
   ```
3. **Build AAB** (obligatoire pour le Play Store) :
   - Android Studio → Build → Generate Signed App Bundle → Android App Bundle
   - ou en ligne de commande : `cd android && ./gradlew bundleRelease`
4. **Fiche store** : nom, description FR, captures d'écran (téléphone 1080×1920+),
   icône 512×512, bannière 1024×500, catégorie, e-mail de contact,
   **politique de confidentialité** (URL publique — obligatoire).
5. **Formulaires contenu** : classification du contenu, public cible, données
   collectées (localisation, photos → déclarer !).
6. Upload du `.aab` → tests internes → production.

> 💡 Recommandé : publier d'abord en **test interne/fermé** pour valider
> l'installation et la connexion au serveur, puis ouvrir en production.

## 🍎 Publication — App Store (macOS requis)

1. **Compte** Apple Developer (99 $/an) : https://developer.apple.com
2. Ouvrir `ios/App/App.xcworkspace` dans Xcode (`npm run mobile:ios`).
3. Onglet **Signing & Capabilities** : Team + identifiant de bundle
   `com.socline.app` (ou votre identifiant) + provisioning automatique.
4. **Produit → Archive** → Distribute App → App Store Connect.
5. Dans App Store Connect : captures d'écran, description, politique de
   confidentialité, fiche → soumettre à la review.
6. Les notifications push iOS nécessitent les clés APNs (Apple Developer).

## 🔔 Notifications push (à configurer avant activation réelle)

Le plugin `@capacitor/push-notifications` est installé et branché côté code
(`mobileNotifications`), mais l'envoi réel demande :

1. **Android** : créer un projet Firebase → ajouter l'app Android
   `com.socline.app` → télécharger `google-services.json` → le placer dans
   `android/app/` → réactiver le plugin Gradle.
2. **iOS** : clés APNs dans Apple Developer + `Push Notifications` capability.
3. Côté serveur : envoyer les notifications via FCM/APNs (ou Firebase Cloud
   Functions) depuis les événements métier (nouvelle commande, laveur en route…).

## 📱 Fonctionnalités natives (code déjà prêt)

### GPS (Géolocalisation)
```typescript
import { mobileGeolocation } from '@/lib/mobile';

const position = await mobileGeolocation.getCurrentPosition();
const watchId = await mobileGeolocation.watchPosition((pos) => {
  console.log('Position:', pos.latitude, pos.longitude);
});
```

### Caméra
```typescript
import { mobileCamera } from '@/lib/mobile';

const photo = await mobileCamera.takePhoto();
const depuisGalerie = await mobileCamera.pickFromGallery();
```

### Notifications / Stockage / Haptique
```typescript
import { mobileNotifications, mobileAuth, mobileHaptics } from '@/lib/mobile';

await mobileAuth.saveTokens(accessToken, refreshToken); // @capacitor/preferences
await mobileHaptics.impact();                            // retour tactile
```

## 🔐 Authentification mobile (endpoints dédiés)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/mobile/login` | POST | Connexion téléphone + PIN → JWT |
| `/api/auth/mobile/refresh` | POST | Rafraîchir le token |
| `/api/auth/mobile/me` | GET | Infos utilisateur actuel |

Utiliser le hook `useMobileAuth` (`src/hooks/useMobileAuth.ts`), qui appelle
ces endpoints avec `NEXT_PUBLIC_API_URL` (vide = même origine — correct en
mode serveur distant).

## ⚠️ Points d'attention

1. **Débogage WebView** : `webContentsDebuggingEnabled` est activé
   automatiquement en dev (`CAPACITOR_DEV_SERVER_URL`) et **désactivé** pour
   les builds store — vérifier avant publication.
2. **Contenu mixte** : le serveur est en HTTPS, `allowMixedContent` est activé
   pour tolérer les médias HTTP tiers éventuels.
3. **Sockets temps réel** : `io('/?XTransformPort=3003|3005')` en chemins
   relatifs → fonctionnent depuis la WebView car même origine (nginx route).
4. **Comptes démo** : admin `71998155` · client `90123456` · laveur `90234567`
   (PIN `1234`) — à changer avant production réelle.
5. **Keystore Android** : ne JAMAIS le commiter dans Git ni le perdre.

## 🗺️ Roadmap

- [x] Projet natif Android généré
- [x] Projet natif iOS généré
- [x] Mode serveur distant (mises à jour auto sans APK)
- [ ] Icônes et splash personnalisés Socline
- [ ] Notifications push réelles (Firebase + APNs)
- [ ] Biométrie (Face ID / empreinte)
- [ ] Deep linking (ouvrir les liens socline.oquitogo.com dans l'app)
- [ ] Mode offline (cache des écrans principaux)
