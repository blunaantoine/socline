import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { verifyOtp, normalizeOtpPhone } from '@/lib/otp';

// POST /api/auth/verify-otp - Verify OTP and login/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp, name, role } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone and OTP are required' },
        { status: 400 }
      );
    }

    // Real verification against the hashed OTP stored in DB
    // (expiry, max 5 attempts, one-time use — see src/lib/otp.ts).
    const otpResult = await verifyOtp(phone, otp);
    if (!otpResult.ok) {
      return NextResponse.json(
        { success: false, error: otpResult.error },
        { status: otpResult.status ?? 400 }
      );
    }

    // Same normalization as send-otp so the user lookup key matches.
    const cleanPhone = normalizeOtpPhone(phone);

    // Check if user exists
    let user = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      // Register new user
      user = await db.user.create({
        data: {
          phone: cleanPhone,
          name: name || `User_${cleanPhone.slice(-4)}`,
          role: role || 'CLIENT',
        },
      });

      // If registering as washer, create washer profile
      if (role === 'WASHER') {
        await db.washer.create({
          data: {
            userId: user.id,
          },
        });
      }
    }

    // Generate auth token and set cookie
    const token = generateToken(user.id);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
