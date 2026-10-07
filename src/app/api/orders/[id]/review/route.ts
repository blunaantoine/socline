import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';

// POST /api/orders/[id]/review - Rate a completed wash.
// The order's client rates the service (1–5 stars + optional comment) once
// the order is COMPLETED. Optionally flags the washer as a favorite.
// The washer's aggregate rating is recomputed from ALL his reviews.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }
    const session = auth.user;

    const body = await request.json();
    const { rating, comment, favorite } = body;

    const ratingValue = Number(rating);
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return NextResponse.json(
        { success: false, error: 'La note doit être entre 1 et 5 étoiles' },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
        service: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Commande non trouvée' }, { status: 404 });
    }

    if (order.clientId !== session.id) {
      return NextResponse.json({ success: false, error: 'Accès non autorisé' }, { status: 403 });
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Vous pourrez noter ce lavage une fois terminé.' },
        { status: 400 }
      );
    }

    const existing = await db.review.findUnique({ where: { orderId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Vous avez déjà noté cette commande' },
        { status: 400 }
      );
    }

    // Create the review + recompute the washer aggregate rating atomically.
    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId,
          clientId: order.clientId,
          washerId: order.washerId || null,
          rating: ratingValue,
          comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
        },
      });

      if (order.washerId) {
        const agg = await tx.review.aggregate({
          where: { washerId: order.washerId },
          _avg: { rating: true },
          _count: { rating: true },
        });
        await tx.washer.update({
          where: { id: order.washerId },
          data: {
            rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
            totalRatings: agg._count.rating,
          },
        });
      }

      return created;
    });

    // Optional favorite flag — the client bookmarked this washer.
    let favorited = false;
    if (favorite === true && order.washerId) {
      await db.favorite.upsert({
        where: { clientId_washerId: { clientId: order.clientId, washerId: order.washerId } },
        create: { clientId: order.clientId, washerId: order.washerId },
        update: {},
      });
      favorited = true;
    }

    // Thank the washer (best-effort).
    if (order.washer?.userId) {
      await notify({
        userId: order.washer.userId,
        title: `Nouvel avis ${'⭐'.repeat(ratingValue)}`,
        message: `${order.client?.name || 'Le client'} a noté « ${order.service?.name || 'votre prestation'} » ${ratingValue}/5${comment ? ` — « ${String(comment).slice(0, 80)} »` : ''}${favorited ? ' et vous a ajouté en favori ❤️' : ''}.`,
        type: 'review',
        data: { orderId: order.id, orderNumber: order.orderNumber, rating: ratingValue },
      });
    }

    return NextResponse.json({ success: true, review, favorited });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\u2019envoi de l\u2019avis' },
      { status: 500 }
    );
  }
}
