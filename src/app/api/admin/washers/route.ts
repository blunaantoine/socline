import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPin, requireAdmin } from '@/lib/auth';
import { notify } from '@/lib/notify';

// POST /api/admin/washers - Create a new washer
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { name, phone, email, pin, isVerified, userId } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Le téléphone est requis' }, { status: 400 });
    }

    // Validate optional PIN format (4 digits) if provided
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Le PIN doit contenir exactement 4 chiffres' }, { status: 400 });
    }

    // Check if user already exists
    let user = await db.user.findUnique({
      where: { phone },
    });

    if (user) {
      // User exists, check if already a washer
      const existingWasher = await db.washer.findUnique({
        where: { userId: user.id },
      });

      if (existingWasher) {
        return NextResponse.json({ error: 'Cet utilisateur est déjà un laveur' }, { status: 400 });
      }

      // Update user role to WASHER
      user = await db.user.update({
        where: { id: user.id },
        data: {
          role: 'WASHER',
          name: name || user.name,
        },
      });
    } else {
      // Create new user with WASHER role
      // SECURITY: the PIN must always be stored hashed (bcrypt), never in
      // plaintext — a plaintext default ('1234') would be readable by anyone
      // with database access.
      user = await db.user.create({
        data: {
          phone,
          name: name || null,
          email: email || null,
          pin: await hashPin(pin || '1234'),
          role: 'WASHER',
          isActive: true,
        },
      });
    }

    // Create washer profile
    const washer = await db.washer.create({
      data: {
        userId: user.id,
        isAvailable: true,
        isVerified: isVerified !== undefined ? isVerified : true, // Auto-verify by default
        rating: 0,
        totalRatings: 0,
        totalEarnings: 0,
        completedJobs: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      washer: {
        id: washer.id,
        name: washer.user.name,
        phone: washer.user.phone,
        email: washer.user.email,
        isVerified: washer.isVerified,
        isAvailable: washer.isAvailable,
      },
    });
  } catch (error) {
    console.error('Create washer error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

// GET /api/admin/washers - Get all washers
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // 'pending', 'verified', 'all'

    const where = {
      ...(search && {
        user: {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        },
      }),
      ...(status === 'pending' && { isVerified: false }),
      ...(status === 'verified' && { isVerified: true }),
    };

    const washers = await db.washer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get order counts for each washer
    const washersWithOrders = await Promise.all(
      washers.map(async (washer) => {
        const completedOrders = await db.order.count({
          where: { washerId: washer.id, status: 'COMPLETED' },
        });

        const earnings = await db.order.aggregate({
          where: { washerId: washer.id, status: 'COMPLETED' },
          _sum: { totalPrice: true, commission: true },
        });

        return {
          id: washer.id,
          userId: washer.userId,
          name: washer.user.name || 'N/A',
          phone: washer.user.phone,
          email: washer.user.email || '',
          rating: washer.rating,
          totalRatings: washer.totalRatings,
          completedJobs: completedOrders,
          // Partner share = total collected - commissions actually applied
          // per order (Contrat Article 5: commission depends on washer level)
          earnings: (earnings._sum.totalPrice || 0) - (earnings._sum.commission || 0),
          // Commission espèces à recouvrer (encaissements CASH non soldés)
          cashDebt: washer.cashDebt,
          isAvailable: washer.isAvailable,
          isVerified: washer.isVerified,
          createdAt: washer.user.createdAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      washers: washersWithOrders,
    });
  } catch (error) {
    console.error('Get washers error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/washers - Update washer (verify, etc.)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { washerId, action } = body; // action: 'verify', 'reject', 'suspend', 'recover-commission'

    if (!washerId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // ---------------------------------------------------------------
    // RECOUVREMENT DE LA COMMISSION ESPÈCES — déduit la dette (cashDebt)
    // du solde du PORTEFEUILLE du laveur (ex: après un rechargement).
    // Réglages partiels supportés : on recouvre min(cashDebt, balance).
    // ---------------------------------------------------------------
    if (action === 'recover-commission') {
      const washer = await db.washer.findUnique({
        where: { id: washerId },
        include: { user: { select: { name: true, phone: true } } },
      });

      if (!washer) {
        return NextResponse.json({ error: 'Laveur non trouvé' }, { status: 404 });
      }

      if (washer.cashDebt <= 0) {
        return NextResponse.json(
          { error: 'Ce laveur n\'a aucune commission espèces à recouvrer' },
          { status: 400 }
        );
      }

      const wallet = await db.wallet.findUnique({
        where: { userId: washer.userId },
      });

      if (!wallet || wallet.balance <= 0) {
        return NextResponse.json(
          {
            error: `Portefeuille insuffisant (${(wallet?.balance ?? 0).toLocaleString('fr-FR')} XOF). Le laveur doit recharger son portefeuille — la dette de ${washer.cashDebt.toLocaleString('fr-FR')} XOF bloque déjà ses retraits.`,
            cashDebt: washer.cashDebt,
            balance: wallet?.balance ?? 0,
          },
          { status: 400 }
        );
      }

      const recovered = Math.min(washer.cashDebt, wallet.balance);

      const result = await db.$transaction(async (tx) => {
        const freshWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
        if (!freshWallet || freshWallet.balance < recovered) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        const freshWasher = await tx.washer.findUnique({ where: { id: washer.id } });
        if (!freshWasher || freshWasher.cashDebt <= 0) {
          throw new Error('NO_DEBT');
        }

        const applied = Math.min(freshWasher.cashDebt, recovered);

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: freshWallet.id,
            type: 'COMMISSION_SETTLEMENT',
            amount: applied,
            status: 'COMPLETED',
            description: 'Recouvrement commission espèces — par administrateur SOCLINE',
            balanceAfter: freshWallet.balance - applied,
          },
        });

        const updatedWallet = await tx.wallet.update({
          where: { id: freshWallet.id },
          data: {
            balance: { decrement: applied },
            totalSpent: { increment: applied },
          },
        });

        const updatedWasher = await tx.washer.update({
          where: { id: washer.id },
          data: { cashDebt: { decrement: applied } },
        });

        return { transaction, updatedWallet, updatedWasher, applied };
      });

      const remaining = Math.max(0, result.updatedWasher.cashDebt);
      const fmt = (n: number) => n.toLocaleString('fr-FR');

      // Trace: notify the washer — best-effort.
      try {
        await notify({
          userId: washer.userId,
          type: 'payment',
          title: 'Commission recouvrée 💰',
          message: remaining > 0
            ? `${fmt(result.applied)} XOF de commission ont été prélevés sur votre portefeuille par l'administration. Reste dû : ${fmt(remaining)} XOF.`
            : `${fmt(result.applied)} XOF de commission ont été prélevés sur votre portefeuille par l'administration. Votre dette est soldée ✅`,
          data: { recovered: result.applied, remaining },
        });
      } catch (error) {
        console.warn('[AdminRecoverCommission] notification failed:', error);
      }

      return NextResponse.json({
        success: true,
        recovered: result.applied,
        remainingDebt: remaining,
        balance: result.updatedWallet.balance,
        message:
          remaining > 0
            ? `${fmt(result.applied)} XOF recouvrés. Reste dû : ${fmt(remaining)} XOF.`
            : `Commission entièrement recouvrée (${fmt(result.applied)} XOF) ✅`,
      });
    }

    let updateData: any = {};

    switch (action) {
      case 'verify':
        updateData.isVerified = true;
        break;
      case 'reject':
      case 'suspend':
        // For reject/suspend, we would need to delete or deactivate
        // For now, just mark as not verified
        updateData.isVerified = false;
        break;
      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    const washer = await db.washer.update({
      where: { id: washerId },
      data: updateData,
      include: {
        user: { select: { name: true, phone: true } },
      },
    });

    return NextResponse.json({ success: true, washer });
  } catch (error) {
    console.error('Update washer error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
