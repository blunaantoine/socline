# Socline Mobile — Application Android (Capacitor)

## 📱 Architecture

L'APK est un **shell natif Capacitor** : splash screen orange, icône monogramme SC,
plein écran — et il charge la plateforme **https://socline.oquitogo.com**.

```
┌────────────────────────────────────────────┐
│  APK Socline (com.socline.app)             │
│  Splash orange 2s → WebView sécurisée      │
└──────────────────┬─────────────────────────┘
                   │ https://socline.oquitogo.com
                   ▼
┌────────────────────────────────────────────┐
│  PLATEFORME SOCLINE (Next.js sur VPS)      │
│  App client / laveur / admin               │
│  API REST + WebSocket temps réel           │
└────────────────────────────────────────────┘
```

**Avantage clé** : l'application affiche toujours la dernière version du site.
Une évolution livrée sur le VPS est immédiatement dans l'APK — **aucun rebuild
nécessaire** (sauf changement natif : icône, plugins, permissions).

## 🚀 Générer l'APK (Android Studio installé)

### 1. Synchroniser le projet (après tout changement de `capacitor.config.ts`)
```bash
npx cap sync android
```

### 2. Ouvrir dans Android Studio
```bash
npx cap open android
# ou manuellement : File > Open > dossier /android du projet
```

### 3. Premier lancement
- Laisser **Gradle Sync** se terminer (téléchargement automatique des dépendances).
- Si Android Studio propose d'installer le SDK 36 : accepter.

### 4. Construire l'APK
- Menu **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
- L'APK se trouve dans :
  `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Installer sur un téléphone
- Transférer `app-debug.apk` sur le téléphone (WhatsApp, câble USB, Drive…).
- Ouvrir le fichier → autoriser « Installer des applications inconnues » → Installer.
- L'icône **SC** apparaît avec le splash orange Socline.

> Astuce : tester d'abord sur émulateur (Device Manager > ▶️) avant un vrai téléphone.

## 🔧 Développement local (optionnel)

Pour que l'APK charge un serveur local au lieu de la production, dans
`capacitor.config.ts` :
```ts
server: {
  androidScheme: 'https',
  // url: 'https://socline.oquitogo.com',      // ← commenter cette ligne
  url: 'http://10.0.2.2:3000',                 // ← décommenter (émulateur)
  cleartext: true,
},
```
puis :
```bash
bun run dev          # serveur sur le port 3000
npx cap sync android
npx cap run android  # build + lancement sur émulateur/appareil branché
```

## 🖼️ Icône et splash screen

Les sources sont dans le dossier `assets/` du projet :
- `assets/icon.png` (1024×1024) — monogramme SC sur fond noir ;
- `assets/splash.png` (2732×2732) — SC sur fond orange `#FF9800`.

Après modification, régénérer les ressources natives :
```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#1a1a1a' --iconBackgroundColorDark '#1a1a1a' \
  --splashBackgroundColor '#FF9800' --splashBackgroundColorDark '#FF9800'
npx cap sync android
```

## 📦 Publication Google Play (plus tard)

1. Compte Google Play Console (25 $ unique).
2. Générer un **AAB signé** : Build > Generate Signed App Bundle / APK (créer un keystore,
   le conserver précieusement — il signe toutes les mises à jour futures).
3. Remplir la fiche Play Store (captures, description, politique de confidentialité).
4. Soumettre à la review.

## ⚠️ Points d'attention

1. **Connexion internet obligatoire** : l'app charge la plateforme en ligne ;
   sans réseau, Android affiche son écran d'erreur WebView (v1 acceptable).
2. **Permissions natives** (GPS, caméra) : accordées à la demande quand le site
   les sollicite depuis la WebView.
3. **`server.url` pointe sur la production** : ne pas oublier de le commenter en dev.
4. Après toute modification de `capacitor.config.ts` → toujours `npx cap sync android`.

## 🗺️ Roadmap

- [x] Projet Android complet (Gradle, icônes SC, splash orange)
- [x] WebView sur la plateforme de production
- [ ] Écran offline embarqué (remplacer l'écran d'erreur natif)
- [ ] Notifications push (Firebase Cloud Messaging)
- [ ] Deep linking (ouvrir socline.oquitogo.com dans l'app)
- [ ] Version iOS (Xcode requis, `npx cap add ios`)
