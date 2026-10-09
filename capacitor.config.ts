import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Socline — application Android/iOS (Capacitor).
 *
 * ARCHITECTURE : shell natif (splash orange, icône SC, plein écran) qui charge
 * la plateforme https://socline.oquitogo.com. Avantages :
 *  - l'application affiche toujours la version la plus récente (aucun rebuild
 *    de l'APK à chaque évolution du site : déployer suffit) ;
 *  - API, WebSocket temps réel, Google Maps et paiements fonctionnent d'emblée
 *    (même origine que le site).
 */
const config: CapacitorConfig = {
  appId: 'com.socline.app',
  appName: 'Socline',
  // Contenu embarqué minimal : écran de secours qui redirige vers la plateforme.
  webDir: 'app-shell',
  server: {
    androidScheme: 'https',
    // En production l'APK charge directement la plateforme.
    url: 'https://socline.oquitogo.com',
    // Pour développer en local : commenter `url` ci-dessus puis décommenter ici
    // (10.0.2.2 = localhost de la machine vue depuis l'émulateur Android) :
    // url: 'http://10.0.2.2:3000',
    // cleartext: true,
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
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
};

export default config;
