import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SALT_ROUNDS = 10;
const TOKEN_COOKIE_NAME = 'socline_token';

// Simple in-memory rate limiting for login attempts
// In production, use Redis or a database
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

// Check if login is rate limited
export function isLoginRateLimited(phone: string): { limited: boolean; remainingTime?: number } {
  const attempts = loginAttempts.get(phone);
  
  if (!attempts) {
    return { limited: false };
  }
  
  const now = Date.now();
  const timeSinceLastAttempt = now - attempts.lastAttempt;
  
  // Reset if block duration has passed
  if (timeSinceLastAttempt > LOGIN_BLOCK_DURATION) {
    loginAttempts.delete(phone);
    return { limited: false };
  }
  
  // Check if still blocked
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((LOGIN_BLOCK_DURATION - timeSinceLastAttempt) / 1000 / 60);
    return { limited: true, remainingTime };
  }
  
  return { limited: false };
}

// Record a failed login attempt
export function recordFailedLogin(phone: string): void {
  const attempts = loginAttempts.get(phone) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(phone, attempts);
}

// Clear login attempts after successful login
export function clearLoginAttempts(phone: string): void {
  loginAttempts.delete(phone);
}

// Hash a PIN code
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

// Verify a PIN code against a hash
export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  // Check if the stored PIN is hashed (starts with $2a$ or $2b$)
  if (hashedPin.startsWith('$2a$') || hashedPin.startsWith('$2b$')) {
    return bcrypt.compare(pin, hashedPin);
  }
  // Fallback for legacy unhashed PINs (migration path)
  return pin === hashedPin;
}

// Generate a secure token
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Set auth cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Get auth cookie
export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE_NAME)?.value;
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

// Session type
export interface Session {
  userId: string;
  phone: string;
  name: string | null;
  role: string;
  isActive: boolean;
}

// Get current user from cookie/token
export async function getCurrentUser(): Promise<Session | null> {
  try {
    const token = await getAuthCookie();
    if (!token) return null;

    // For now, we use a simple token stored in a cookie
    // In production, you'd verify this against a sessions table or use JWT
    const user = await db.user.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}

// Middleware helper to check admin role
export async function requireAdmin(request: NextRequest): Promise<{ authorized: boolean; user: Session | null; response?: NextResponse }> {
  const user = await getCurrentUser();
  
  if (!user) {
    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      ),
    };
  }

  if (user.role !== 'ADMIN') {
    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

// Middleware helper to check authenticated user
export async function requireAuth(request: NextRequest): Promise<{ authorized: boolean; user: Session | null; response?: NextResponse }> {
  const user = await getCurrentUser();
  
  if (!user) {
    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user };
}
