# Socline Mobile - Guide de développement

## 📱 Architecture

```
┌─────────────────────────────────────────────┐
│           APPLICATION MOBILE                 │
│  Next.js + Capacitor (Android/iOS)          │
│  - Interface Client / Laveur / Admin         │
│  - GPS, Caméra, Notifications                │
└────────────────────┬────────────────────────┘
                     │ API REST (JWT)
                     ▼
┌─────────────────────────────────────────────┐
│           BACKEND SERVEUR                    │
│  Next.js API Routes                          │
│  - Authentification JWT                      │
│  - Base de données                           │
└─────────────────────────────────────────────┘
```

## 🚀 Commandes disponibles

### Développement Web
```bash
bun run dev          # Serveur de développement
bun run build        # Build production (serveur)
bun run start        # Démarrer le serveur de production
```

### Développement Mobile
```bash
bun run mobile:build        # Build pour mobile (static export)
bun run mobile:sync         # Sync Capacitor
bun run mobile:android      # Ouvrir Android Studio
bun run mobile:ios          # Ouvrir Xcode
bun run mobile:run:android  # Lancer sur Android
bun run mobile:run:ios      # Lancer sur iOS
```

## 🔧 Configuration initiale

### 1. Installer Android Studio (pour Android)
- Télécharger: https://developer.android.com/studio
- Configurer les SDK Android

### 2. Installer Xcode (pour iOS - macOS uniquement)
- Depuis le Mac App Store
- Configurer les certificats de développement

### 3. Ajouter les plateformes
```bash
npx cap add android
npx cap add ios
```

## 📱 Fonctionnalités natives

### GPS (Géolocalisation)
```typescript
import { mobileGeolocation } from '@/lib/mobile';

// Obtenir la position actuelle
const position = await mobileGeolocation.getCurrentPosition();

// Suivre la position en temps réel
const watchId = await mobileGeolocation.watchPosition((pos) => {
  console.log('Position:', pos.latitude, pos.longitude);
});
```

### Caméra
```typescript
import { mobileCamera } from '@/lib/mobile';

// Prendre une photo
const photo = await mobileCamera.takePhoto();

// Choisir depuis la galerie
const photo = await mobileCamera.pickFromGallery();
```

### Notifications Push
```typescript
import { mobileNotifications } from '@/lib/mobile';

// Demander les permissions
const granted = await mobileNotifications.requestPermissions();

// S'enregistrer pour les notifications
await mobileNotifications.register();

// Écouter les notifications
mobileNotifications.addListeners(
  (token) => console.log('Token:', token),
  (notification) => console.log('Notification:', notification)
);
```

### Stockage local
```typescript
import { mobileAuth } from '@/lib/mobile';

// Sauvegarder les tokens
await mobileAuth.saveTokens(accessToken, refreshToken);

// Récupérer le token
const token = await mobileAuth.getAccessToken();

// Déconnexion
await mobileAuth.clearAuth();
```

## 🔐 Authentification JWT

### Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/mobile/login` | POST | Connexion (retourne JWT) |
| `/api/auth/mobile/refresh` | POST | Rafraîchir le token |
| `/api/auth/mobile/me` | GET | Infos utilisateur actuel |

### Exemple de connexion
```typescript
const response = await fetch('/api/auth/mobile/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '90123456', pin: '1234' }),
});

const { accessToken, refreshToken, user } = await response.json();
```

### Utiliser le hook React
```typescript
import { useMobileAuth } from '@/hooks/useMobileAuth';

function MyComponent() {
  const { user, isLoading, login, logout } = useMobileAuth();

  if (isLoading) return <div>Chargement...</div>;
  
  if (!user) {
    return <LoginForm onSubmit={login} />;
  }

  return (
    <div>
      <p>Bonjour {user.name}</p>
      <button onClick={logout}>Déconnexion</button>
    </div>
  );
}
```

## 🌐 Configuration de l'API

Pour la production, configurer l'URL de l'API dans `.env`:

```env
NEXT_PUBLIC_API_URL=https://api.socline.com
JWT_SECRET=votre-secret-jwt-tres-securise
```

## 📦 Publication sur les Stores

### Google Play Store
1. Créer un compte Google Play Console (25$ unique)
2. Build en mode release: `cd android && ./gradlew assembleRelease`
3. Upload l'APK/AAB sur la console
4. Remplir les informations de l'app

### Apple App Store
1. Créer un compte Apple Developer (99$/an)
2. Configurer les certificats et provisioning profiles
3. Build avec Xcode: Archive > Distribute
4. Upload via Transporter
5. Soumettre pour review

## ⚠️ Points d'attention

1. **Images**: En mode static export, les images doivent être non optimisées (`unoptimized: true`)
2. **API Routes**: Ne fonctionnent pas en static export - utiliser un serveur séparé
3. **Cookies**: Non supportés en mobile - utiliser JWT
4. **Variables d'env**: Utiliser `NEXT_PUBLIC_` pour le client

## 🗺️ Roadmap

- [ ] Mode offline complet
- [ ] Synchronisation des données
- [ ] Biométrie (Face ID / Touch ID)
- [ ] Deep linking
- [ ] App shortcuts
- [ ] Widgets
