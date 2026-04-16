import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

// Generate random token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

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

    // In production, verify OTP from Redis/SMS service
    // For demo, accept any 6-digit OTP
    if (otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP' },
        { status: 400 }
      );
    }

    // Check if user exists
    let user = await db.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // Register new user
      user = await db.user.create({
        data: {
          phone,
          name: name || `User_${phone.slice(-4)}`,
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

    // Generate auth token
    const token = generateToken();

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
