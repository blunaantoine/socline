import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SALT_ROUNDS = 10;
const TOKEN_COOKIE_NAME = 'socline_token';

// JWT secret shared with the mobile API (src/lib/jwt.ts).
// Must be set in .env in production.
const SESSION_JWT_SECRET = process.env.JWT_SECRET || 'socline-jwt-secret-change-in-production';
const SESSION_EXPIRES_IN = '7d';

interface SessionTokenPayload {
  userId: string;
}

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

// Generate a signed JWT session token with userId embedded.
// The token is cryptographically signed: it cannot be forged without JWT_SECRET.
export function generateToken(userId: string): string {
  return jwt.sign({ userId } satisfies SessionTokenPayload, SESSION_JWT_SECRET, {
    expiresIn: SESSION_EXPIRES_IN,
  });
}

// Verify the signed token and extract the userId.
// Rejects forged, tampered or expired tokens.
function parseToken(token: string): SessionTokenPayload | null {
  try {
    const payload = jwt.verify(token, SESSION_JWT_SECRET) as SessionTokenPayload;
    if (payload && typeof payload.userId === 'string' && payload.userId) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
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
// Note: `id` (not `userId`) because getCurrentUser() returns the User record
// selected with `id: true` from the database.
export interface Session {
  id: string;
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

    // Parse the token to get userId
    const parsed = parseToken(token);
    if (!parsed || !parsed.userId) return null;

    // Find the user by ID from the token
    const user = await db.user.findUnique({
      where: { id: parsed.userId },
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
