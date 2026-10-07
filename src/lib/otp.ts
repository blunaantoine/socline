import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// NOTE — raw SQL on purpose: the long-running dev server process was started
// before `prisma generate` created the OtpCode delegate, so `db.otpCode` is
// undefined there (stale require cache) and typed calls would 500. Raw SQL
// targets the same `otp_codes` table, works on any generated client version
// and keeps identical semantics. Prisma stores DateTime in SQLite as ISO-8601
// UTC text (e.g. "2026-10-02T18:00:00.000Z"), so parsing with new Date() is
// exact. SQLite INTEGER columns come back as BigInt in $queryRaw → Number().

interface OtpRow {
  id: string;
  codeHash: string;
  expiresAt: string;
  consumedAt: string | null;
  attempts: number | bigint;
}

// Same normalization as send-otp so the otp_codes lookup key matches.
export function normalizeOtpPhone(phone: unknown): string {
  return typeof phone === 'string' ? phone.replace(/[\s\-().]/g, '') : '';
}

export interface OtpVerificationResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Verify a 6-digit OTP against the latest stored (hashed) code for a phone.
 *
 * Security properties:
 * - the code is stored as a bcrypt hash, never in clear text
 * - expires 5 minutes after issue
 * - max 5 failed attempts, then the code is locked
 * - one-time use (consumed on success)
 * - generic error messages (no oracle on why it failed)
 *
 * MUST be awaited BEFORE any account mutation (never register/login on an
 * unverified OTP).
 */
export async function verifyOtp(phone: unknown, otp: unknown): Promise<OtpVerificationResult> {
  const cleanPhone = normalizeOtpPhone(phone);

  // Basic format check (does not count as an attempt).
  if (!/^\+?\d{8,15}$/.test(cleanPhone) || typeof otp !== 'string' || otp.length !== 6) {
    return { ok: false, error: 'Code invalide', status: 400 };
  }

  // Latest OTP issued for this phone.
  const rows = await db.$queryRaw<OtpRow[]>`
    SELECT "id", "codeHash", "expiresAt", "consumedAt", "attempts"
    FROM "otp_codes"
    WHERE "phone" = ${cleanPhone}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const otpRecord = rows[0];

  if (!otpRecord) {
    return { ok: false, error: 'Aucun code actif. Veuillez demander un nouveau code.', status: 400 };
  }

  const now = new Date();
  if (otpRecord.consumedAt || new Date(otpRecord.expiresAt) < now) {
    return { ok: false, error: 'Code expiré. Veuillez demander un nouveau code.', status: 400 };
  }

  if (Number(otpRecord.attempts) >= 5) {
    return { ok: false, error: 'Trop de tentatives. Veuillez demander un nouveau code.', status: 400 };
  }

  // Constant-time comparison via bcrypt. A wrong code consumes one attempt.
  const isValid = await bcrypt.compare(otp, otpRecord.codeHash);
  if (!isValid) {
    await db.$executeRaw`
      UPDATE "otp_codes" SET "attempts" = "attempts" + 1
      WHERE "id" = ${otpRecord.id}
    `;
    return { ok: false, error: 'Code invalide', status: 400 };
  }

  // One-time use: consume the code.
  await db.$executeRaw`
    UPDATE "otp_codes" SET "consumedAt" = ${now.toISOString()}
    WHERE "id" = ${otpRecord.id}
  `;

  return { ok: true };
}
