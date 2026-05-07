/**
 * Socline Mobile Utilities
 * Fonctions utilitaires pour l'application mobile Capacitor
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

// Check if running on native platform
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// ============================================
// STORAGE - Stockage local sécurisé
// ============================================

export const mobileStorage = {
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },

  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },

  async clear(): Promise<void> {
    await Preferences.clear();
  },
};

// ============================================
// AUTH - Gestion des tokens JWT pour mobile
// ============================================

const AUTH_TOKEN_KEY = 'socline_auth_token';
const REFRESH_TOKEN_KEY = 'socline_refresh_token';
const USER_DATA_KEY = 'socline_user_data';

export const mobileAuth = {
  async saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await mobileStorage.set(AUTH_TOKEN_KEY, accessToken);
    if (refreshToken) {
      await mobileStorage.set(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  async getAccessToken(): Promise<string | null> {
    return mobileStorage.get(AUTH_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return mobileStorage.get(REFRESH_TOKEN_KEY);
  },

  async saveUserData(userData: string): Promise<void> {
    await mobileStorage.set(USER_DATA_KEY, userData);
  },

  async getUserData(): Promise<string | null> {
    return mobileStorage.get(USER_DATA_KEY);
  },

  async clearAuth(): Promise<void> {
    await mobileStorage.remove(AUTH_TOKEN_KEY);
    await mobileStorage.remove(REFRESH_TOKEN_KEY);
    await mobileStorage.remove(USER_DATA_KEY);
  },

  async isLoggedIn(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  },
};

// ============================================
// GEOLOCATION - GPS pour suivi laveurs
// ============================================

export const mobileGeolocation = {
  async getCurrentPosition(): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null> {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
      };
    } catch (error) {
      console.error('Geolocation error:', error);
      return null;
    }
  },

  async watchPosition(
    callback: (position: { latitude: number; longitude: number }) => void
  ): Promise<string> {
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (position, err) => {
        if (err) {
          console.error('Watch position error:', err);
          return;
        }
        if (position) {
          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      }
    );
    return watchId;
  },

  async clearWatch(watchId: string): Promise<void> {
    await Geolocation.clearWatch({ id: watchId });
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await Geolocation.requestPermissions();
      return result.location === 'granted';
    } catch {
      return false;
    }
  },
};

// ============================================
// CAMERA - Photos avant/après lavage
// ============================================

export const mobileCamera = {
  async takePhoto(): Promise<string | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      return `data:image/jpeg;base64,${photo.base64String}`;
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  },

  async pickFromGallery(): Promise<string | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      return `data:image/jpeg;base64,${photo.base64String}`;
    } catch (error) {
      console.error('Gallery error:', error);
      return null;
    }
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await Camera.requestPermissions();
      return result.camera === 'granted';
    } catch {
      return false;
    }
  },
};

// ============================================
// NETWORK - Vérification connexion
// ============================================

export const mobileNetwork = {
  async getStatus(): Promise<{ connected: boolean; connectionType: string }> {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType,
    };
  },

  addListener(
    callback: (status: { connected: boolean; connectionType: string }) => void
  ): void {
    Network.addListener('networkStatusChange', (status) => {
      callback({
        connected: status.connected,
        connectionType: status.connectionType,
      });
    });
  },
};

// ============================================
// NOTIFICATIONS - Push notifications
// ============================================

export const mobileNotifications = {
  async requestPermissions(): Promise<boolean> {
    try {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch {
      return false;
    }
  },

  async register(): Promise<void> {
    await PushNotifications.register();
  },

  async getDeliveredNotifications(): Promise<unknown[]> {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  },

  addListeners(
    onRegistration: (token: string) => void,
    onNotification: (notification: unknown) => void
  ): void {
    PushNotifications.addListener('registration', (token) => {
      onRegistration(token.value);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      onNotification(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Notification action:', action);
    });
  },
};

// ============================================
// HAPTICS - Vibrations pour feedback
// ============================================

export const mobileHaptics = {
  async impact(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium });
  },

  async notification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
    const notificationTypes: Record<string, 'SUCCESS' | 'WARNING' | 'ERROR'> = {
      success: 'SUCCESS',
      warning: 'WARNING',
      error: 'ERROR',
    };
    await Haptics.notification({ type: notificationTypes[type] as 'SUCCESS' | 'WARNING' | 'ERROR' });
  },

  async selection(): Promise<void> {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  },
};

// ============================================
// SPLASH & STATUS BAR
// ============================================

export const mobileUI = {
  async hideSplash(): Promise<void> {
    await SplashScreen.hide();
  },

  async showSplash(): Promise<void> {
    await SplashScreen.show({
      showDuration: 2000,
      autoHide: true,
    });
  },

  async setStatusBar(backgroundColor: string = '#FF9800', style: 'light' | 'dark' = 'light'): Promise<void> {
    await StatusBar.setStyle({ style: style === 'light' ? Style.Light : Style.Dark });
    await StatusBar.setBackgroundColor({ color: backgroundColor });
  },
};

// ============================================
// INIT - Initialisation de l'app mobile
// ============================================

export async function initMobileApp(): Promise<void> {
  if (!isNative) {
    console.log('Running on web, skipping native initialization');
    return;
  }

  try {
    // Hide splash screen after app loads
    await mobileUI.hideSplash();
    
    // Set status bar
    await mobileUI.setStatusBar('#FF9800', 'light');
    
    // Check network status
    const networkStatus = await mobileNetwork.getStatus();
    console.log('Network status:', networkStatus);
    
    console.log('Mobile app initialized successfully');
  } catch (error) {
    console.error('Error initializing mobile app:', error);
  }
}
