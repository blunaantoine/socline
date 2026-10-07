import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Socline — configuration Capacitor (Android / iOS)
 *
 * Architecture retenue : MODE SERVEUR DISTANT.
 * La WebView charge directement https://socline.oquitogo.com — aucun
 * build statique Next n'est requis (les ~60 routes API, l'authentification
 * et les sockets Socket.io restent sur le serveur). Le bridge Capacitor
 * est injecté automatiquement dans la page distante : les plugins natifs
 * (caméra, GPS, push, haptique…) fonctionnent normalement.
 *
 * ✅ Avantage : toute mise à jour déployée sur le site est immédiatement
 * disponible dans l'app mobile, SANS refaire d'APK.
 *
 * Développement local (optionnel) : pointer la WebView vers une machine
 * de dev avant `npx cap run` :
 *   CAPACITOR_DEV_SERVER_URL=http://192.168.1.50:3000 npx cap run android
 */
const PROD_URL = 'https://socline.oquitogo.com';
const DEV_URL = process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.socline.app',
  appName: 'Socline',
  // Shell minimal embarqué — requis par `cap sync` (webDir non vide).
  // En pratique il n'est presque jamais affiché tant que server.url est
  // actif ; il sert de page de secours brandée si la config change.
  webDir: 'mobile-shell',
  server: {
    androidScheme: 'https',
    ...(DEV_URL
      ? { url: DEV_URL, cleartext: true } // dev : serveur local (HTTP autorisé)
      : { url: PROD_URL }),               // prod : site distant en HTTPS
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FF9800',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FF9800',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    // Débogage WebView uniquement en dev — désactivé pour les builds store
    webContentsDebuggingEnabled: !!DEV_URL,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
};

export default config;
