import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPin, generateToken, setAuthCookie } from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

// POST /api/auth/register - Register new client or washer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      plateNumber,
      carColor,
      pin,
      otp,
      role,
      // Washer-specific fields
      washerType,
      // Station-specific fields (only used when washerType === 'STATION_OWNER')
      stationName,
      stationAddress,
      stationLatitude,
      stationLongitude,
      stationPhone,
      stationDescription,
    } = body;

    // Validate required fields
    if (!name || !phone || !pin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nom, téléphone et PIN sont requis',
        },
        { status: 400 }
      );
    }

    // Real OTP verification against the hashed code stored in DB
    // (sent by SMS via /api/auth/send-otp — see src/lib/otp.ts).
    // MUST run before any account creation (never register on an
    // unverified OTP).
    const otpResult = await verifyOtp(phone, otp);
    if (!otpResult.ok) {
      return NextResponse.json(
        { success: false, error: otpResult.error },
        { status: otpResult.status ?? 400 }
      );
    }

    // Validate PIN (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'Le PIN doit contenir exactement 4 chiffres' },
        { status: 400 }
      );
    }

    // Validate phone format (Togo: 8 digits starting with 7 or 9)
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^[79]\d{7}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone invalide (8 chiffres commençant par 7 ou 9)' },
        { status: 400 }
      );
    }

    // Determine the user role (default to CLIENT)
    const userRole: 'CLIENT' | 'WASHER' = role === 'WASHER' ? 'WASHER' : 'CLIENT';

    // If registering as a washer, validate washerType
    let resolvedWasherType: 'INDEPENDENT' | 'STATION_OWNER' = 'INDEPENDENT';
    if (userRole === 'WASHER') {
      if (washerType && !['INDEPENDENT', 'STATION_OWNER'].includes(washerType)) {
        return NextResponse.json(
          { success: false, error: 'Type de laveur invalide (INDEPENDENT ou STATION_OWNER)' },
          { status: 400 }
        );
      }
      resolvedWasherType = washerType === 'STATION_OWNER' ? 'STATION_OWNER' : 'INDEPENDENT';

      // STATION_OWNER requires station info
      if (resolvedWasherType === 'STATION_OWNER') {
        if (!stationName || !stationAddress) {
          return NextResponse.json(
            { success: false, error: 'Le nom et l\'adresse de la station sont requis pour un propriétaire de station' },
            { status: 400 }
          );
        }
      }
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ce numéro est déjà enregistré' },
        { status: 400 }
      );
    }

    // Hash the PIN before storing
    const hashedPin = await hashPin(pin);

    // Create user with hashed PIN
    const user = await db.user.create({
      data: {
        phone: cleanPhone,
        name,
        plateNumber: plateNumber?.toUpperCase() || 'NON DEFINI',
        carColor: carColor || 'Non défini',
        pin: hashedPin,
        role: userRole,
      },
    });

    // If registering as a washer, create the Washer record
    if (userRole === 'WASHER') {
      // If washerType is STATION_OWNER, create the station first
      if (resolvedWasherType === 'STATION_OWNER') {
        const station = await db.station.create({
          data: {
            name: stationName,
            address: stationAddress,
            latitude: stationLatitude ? parseFloat(stationLatitude) : null,
            longitude: stationLongitude ? parseFloat(stationLongitude) : null,
            phone: stationPhone || cleanPhone,
            description: stationDescription || null,
            ownerId: user.id,
          },
        });

        // Create washer linked to the station with type STATION_OWNER
        await db.washer.create({
          data: {
            userId: user.id,
            washerType: 'STATION_OWNER',
            stationId: station.id,
          },
        });

        // Generate auth token and set cookie
        const token = generateToken(user.id);
        await setAuthCookie(token);

        return NextResponse.json({
          success: true,
          message: 'Inscription réussie! Station créée.',
          user: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            plateNumber: user.plateNumber,
            carColor: user.carColor,
          },
          washer: {
            washerType: 'STATION_OWNER',
            stationId: station.id,
          },
          station: {
            id: station.id,
            name: station.name,
            address: station.address,
          },
          token,
        });
      }

      // INDEPENDENT washer - no station needed
      await db.washer.create({
        data: {
          userId: user.id,
          washerType: 'INDEPENDENT',
        },
      });

      // Generate auth token and set cookie
      const token = generateToken(user.id);
      await setAuthCookie(token);

      return NextResponse.json({
        success: true,
        message: 'Inscription réussie!',
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          plateNumber: user.plateNumber,
          carColor: user.carColor,
        },
        washer: {
          washerType: 'INDEPENDENT',
        },
        token,
      });
    }

    // Default: CLIENT registration (existing flow)
    // Generate auth token and set cookie
    const token = generateToken(user.id);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Inscription réussie!',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        plateNumber: user.plateNumber,
        carColor: user.carColor,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    );
  }
}
