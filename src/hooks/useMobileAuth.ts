/**
 * useMobileAuth Hook
 * Hook React pour l'authentification mobile avec JWT
 */

import { useState, useCallback, useEffect } from 'react';
import { mobileAuth, isNative, mobileStorage } from '@/lib/mobile';

interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  avatar?: string | null;
}

interface UseMobileAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// API base URL - en production, utiliser l'URL du serveur
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useMobileAuth(): UseMobileAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await mobileAuth.getAccessToken();
        
        if (token) {
          // Récupérer les infos utilisateur
          const userData = await mobileAuth.getUserData();
          if (userData) {
            setUser(JSON.parse(userData));
          } else {
            // Si pas de données utilisateur, les récupérer depuis l'API
            const response = await fetch(`${API_BASE_URL}/api/auth/mobile/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.user) {
                setUser(data.user);
                await mobileAuth.saveUserData(JSON.stringify(data.user));
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Login
  const login = useCallback(async (phone: string, pin: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (data.success && data.accessToken) {
        // Sauvegarder les tokens
        await mobileAuth.saveTokens(data.accessToken, data.refreshToken);
        
        // Sauvegarder les données utilisateur
        if (data.user) {
          await mobileAuth.saveUserData(JSON.stringify(data.user));
          setUser(data.user);
        }

        return { success: true };
      }

      return { success: false, error: data.error || 'Erreur de connexion' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erreur de connexion' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await mobileAuth.clearAuth();
    setUser(null);
  }, []);

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      const refreshTokenValue = await mobileAuth.getRefreshToken();
      
      if (!refreshTokenValue) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      const data = await response.json();

      if (data.success && data.accessToken) {
        await mobileAuth.saveTokens(data.accessToken);
        return true;
      }

      // Si le refresh échoue, déconnecter l'utilisateur
      await logout();
      return false;
    } catch (error) {
      console.error('Refresh token error:', error);
      return false;
    }
  }, [logout]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
  };
}

// ============================================
// Helper pour les requêtes API authentifiées
// ============================================

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await mobileAuth.getAccessToken();
  
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Si 401, essayer de rafraîchir le token
  if (response.status === 401) {
    const refreshToken = await mobileAuth.getRefreshToken();
    
    if (refreshToken) {
      // Tenter le refresh
      const refreshResponse = await fetch('/api/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        if (data.accessToken) {
          await mobileAuth.saveTokens(data.accessToken);
          
          // Retenter la requête originale
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          return fetch(url, { ...options, headers });
        }
      }
    }
    
    // Si refresh échoue, nettoyer l'auth
    await mobileAuth.clearAuth();
  }

  return response;
}
