import { NextRequest, NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { isSmsConfigured, sendSms } from '@/lib/sms';

// In-memory rate limiting per phone (module-level, resets on server restart).
// Production: move to Redis or a DB table.
// Map<phone, timestamps of sends within the current rolling hour>
const otpSendLog = new Map<string, number[]>();
const MIN_RESEND_INTERVAL_MS = 60 * 1000;   // max 1 send per phone per 60s
const MAX_SENDS_PER_HOUR = 5;               // max 5 sends per phone per rolling hour
const HOUR_MS = 60 * 60 * 1000;

// Cryptographically random 6-digit code (zero-padded).
function generateOTP(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// NOTE — raw SQL on purpose: the long-running dev server process was started
// before `prisma generate` created the OtpCode delegate, so `db.otpCode` is
// undefined there (stale require cache) and typed calls would 500. Raw SQL
// targets the same `otp_codes` table, works on any generated client version
// and keeps identical semantics. Prisma stores DateTime in SQLite as ISO-8601
// UTC text (e.g. "2026-10-02T18:00:00.000Z"), so comparing/persisting
// `new Date().toISOString()` strings is exact.

// POST /api/auth/send-otp - Generate an OTP, store it hashed and send it by SMS.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    // Validate: 8–15 digits after stripping non-digits except a leading +.
    const cleanPhone = typeof phone === 'string' ? phone.replace(/[\s\-().]/g, '') : '';
    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone invalide' },
        { status: 400 }
      );
    }

    // Rate limiting: 1 send / 60s, then 5 sends / rolling hour.
    const nowMs = Date.now();
    const now = new Date();
    const sends = (otpSendLog.get(cleanPhone) || []).filter((ts) => nowMs - ts < HOUR_MS);
    const lastSend = sends.length > 0 ? sends[sends.length - 1] : 0;
    if (nowMs - lastSend < MIN_RESEND_INTERVAL_MS) {
      return NextResponse.json(
        { success: false, error: 'Veuillez patienter avant de demander un nouveau code' },
        { status: 429 }
      );
    }
    if (sends.length >= MAX_SENDS_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Trop de codes demandés. Réessayez plus tard.' },
        { status: 429 }
      );
    }
    sends.push(nowMs);
    otpSendLog.set(cleanPhone, sends);

    // Generate + hash the code (bcryptjs, 10 rounds — same convention as
    // hashPin in src/lib/auth.ts), then store with a 5 minutes expiry.
    const code = generateOTP();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(nowMs + 5 * 60 * 1000);

    // Invalidate previous unconsumed codes for this phone.
    await db.$executeRaw`
      UPDATE "otp_codes"
      SET "consumedAt" = ${now.toISOString()}
      WHERE "phone" = ${cleanPhone} AND "consumedAt" IS NULL
    `;

    await db.$executeRaw`
      INSERT INTO "otp_codes" ("id", "phone", "codeHash", "expiresAt", "attempts", "createdAt")
      VALUES (${randomUUID()}, ${cleanPhone}, ${codeHash}, ${expiresAt.toISOString()}, 0, ${now.toISOString()})
    `;

    // Support/debug log (server-side only). With a real provider configured,
    // the code is NEVER returned in the API response.
    console.log('[OTP] code for', cleanPhone, ':', code);

    const smsConfigured = isSmsConfigured();
    if (smsConfigured) {
      const result = await sendSms(cleanPhone, `Votre code Socline est ${code}. Valable 5 minutes.`);
      if (!result.sent) {
        // Do not leak provider errors to the client; the OTP stays verifiable.
        console.error(`[OTP] SMS send failed for ${cleanPhone}:`, result.error);
      }

      // Optional demo fallback (SMS_DEMO_FALLBACK=true): when a provider IS
      // configured but the send fails (no credit, unreachable number…), expose
      // the code in the UI instead of blocking the whole registration flow.
      // MUST be disabled ("false" / unset) in production.
      const demoFallback =
        (process.env.SMS_DEMO_FALLBACK || '').trim().toLowerCase() === 'true';
      if (!result.sent && demoFallback) {
        return NextResponse.json({
          success: true,
          message: 'SMS indisponible pour le moment — mode démo (code affiché pour le test).',
          expiresIn: 300,
          demoMode: true,
          demoCode: code,
          smsSent: false,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Un code de vérification a été envoyé par SMS.',
        expiresIn: 300,
        demoMode: false,
        smsSent: result.sent,
      });
    }

    // Demo mode (no SMS provider configured): the code is exposed so the app
    // stays testable. Only when SMS_PROVIDER is unset/invalid.
    return NextResponse.json({
      success: true,
      message: 'Un code de vérification a été envoyé par SMS.',
      expiresIn: 300,
      demoMode: true,
      demoCode: code,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Échec de l\'envoi du code' },
      { status: 500 }
    );
  }
}
