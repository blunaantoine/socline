import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Generate OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp - Send OTP to phone number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // In production, integrate with SMS service (Twilio, etc.)
    const otp = generateOTP();
    
    // Store OTP (in production, use Redis with expiry)
    // For demo, we'll just return success
    
    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // In development, return the OTP for testing
      otp: '123456', // Always return same OTP for demo
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
