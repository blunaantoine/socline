/**
 * Socline JWT Authentication
 * Système d'authentification pour API mobile
 */

import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import { hashPin, verifyPin } from '@/lib/auth';

// JWT Secret - en production, utiliser une variable d'environnement sécurisée
const JWT_SECRET = process.env.JWT_SECRET || 'socline-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

// Interface pour le payload JWT
export interface JwtPayload {
  userId: string;
  phone: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Interface pour la réponse d'authentification
export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    role: string;
    avatar?: string | null;
  };
  error?: string;
}

// ============================================
// Génération des tokens JWT
// ============================================

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ============================================
// Authentification avec JWT
// ============================================

export async function authenticateWithJWT(
  phone: string,
  pin: string
): Promise<AuthResponse> {
  try {
    // Nettoyer le numéro de téléphone
    const cleanPhone = phone.replace(/\s/g, '');

    // Trouver l'utilisateur
    const user = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      return { success: false, error: 'Numéro non enregistré' };
    }

    // Vérifier le PIN
    if (!user.pin || !(await verifyPin(pin, user.pin))) {
      return { success: false, error: 'PIN incorrect' };
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      return { success: false, error: 'Compte désactivé. Contactez le support.' };
    }

    // Générer les tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  } catch (error) {
    console.error('JWT Auth error:', error);
    return { success: false, error: 'Erreur lors de l\'authentification' };
  }
}

// ============================================
// Vérification du token et récupération user
// ============================================

export async function getUserFromToken(token: string): Promise<{
  id: string;
  phone: string;
  name: string | null;
  role: string;
  isActive: boolean;
} | null> {
  try {
    const payload = verifyAccessToken(token);
    if (!payload) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;

    return user;
  } catch {
    return null;
  }
}

// ============================================
// Middleware helper pour API routes
// ============================================

export async function requireAuthFromHeader(authHeader: string | null): Promise<{
  authorized: boolean;
  user: {
    id: string;
    phone: string;
    name: string | null;
    role: string;
    isActive: boolean;
  } | null;
  error?: string;
}> {
  if (!authHeader) {
    return { authorized: false, user: null, error: 'Token manquant' };
  }

  // Extraire le token du header "Bearer <token>"
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const user = await getUserFromToken(token);

  if (!user) {
    return { authorized: false, user: null, error: 'Token invalide ou expiré' };
  }

  return { authorized: true, user };
}

// ============================================
// Refresh token
// ============================================

export async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return { success: false, error: 'Refresh token invalide' };
    }

    // Vérifier que l'utilisateur existe toujours
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return { success: false, error: 'Utilisateur non trouvé ou inactif' };
    }

    // Générer un nouveau access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      success: true,
      accessToken: newAccessToken,
    };
  } catch (error) {
    console.error('Refresh token error:', error);
    return { success: false, error: 'Erreur lors du rafraîchissement' };
  }
}
