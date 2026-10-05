import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { emitRealtime } from '@/lib/realtime';
import { notify } from '@/lib/notify';

// Max accepted photo size (data URL string length). Photos are downscaled
// client-side to ≤ 900px JPEG (~100–300 KB); 1.5 MB is a hard safety net.
const MAX_PHOTO_LENGTH = 1_500_000;

// POST /api/orders/[id]/photos - Upload a verification photo (BEFORE/AFTER).
// The assigned washer (or an admin) attaches a photo of the car:
//   - BEFORE: while ACCEPTED / EN_ROUTE / ARRIVED — proves the car state
//     when the wash starts.
//   - AFTER: while IN_PROGRESS — proves the result before completion.
// The photo is stored on the Order and shown to the client (tracking +
// completion screen) and the admin (verification).
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
    const { type, photo } = body;

    if (!['BEFORE', 'AFTER'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type de photo invalide' },
        { status: 400 }
      );
    }
    if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: 'Photo invalide' },
        { status: 400 }
      );
    }
    if (photo.length > MAX_PHOTO_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Photo trop lourde — réessayez avec une image plus petite' },
        { status: 413 }
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

    // Authorization: the assigned washer or an admin.
    let isAssignedWasher = false;
    if (session.role === 'WASHER' && order.washerId) {
      const washer = await db.washer.findFirst({
        where: { OR: [{ id: session.id }, { userId: session.id }] },
      });
      isAssignedWasher = !!washer && washer.id === order.washerId;
    }
    if (!isAssignedWasher && session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Status gate: BEFORE before the wash, AFTER during the wash.
    const allowed = type === 'BEFORE'
      ? ['ACCEPTED', 'EN_ROUTE', 'ARRIVED']
      : ['IN_PROGRESS'];
    if (!allowed.includes(order.status)) {
      const expected = type === 'BEFORE'
        ? 'après acceptation et avant de commencer le lavage'
        : 'pendant le lavage (après avoir commencé)';
      return NextResponse.json(
        { success: false, error: `La photo ${type === 'BEFORE' ? 'avant' : 'après'} se prend ${expected}.` },
        { status: 400 }
      );
    }

    // Persist + tracking event in one transaction.
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.order.update({
        where: { id: orderId },
        data: type === 'BEFORE' ? { beforePhotoUrl: photo } : { afterPhotoUrl: photo },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
          service: true,
          car: true,
        },
      });
      await tx.trackingEvent.create({
        data: {
          orderId,
          event: type === 'BEFORE' ? 'BEFORE_PHOTO' : 'AFTER_PHOTO',
          message: type === 'BEFORE'
            ? 'Photo de la voiture avant lavage'
            : 'Photo de la voiture après lavage',
        },
      });
      return saved;
    });

    // Realtime refresh for both parties.
    emitRealtime(
      [
        'order:' + order.id,
        'user:' + order.clientId,
        ...(order.washer?.userId ? ['user:' + order.washer.userId] : []),
      ],
      'order:updated',
      updated
    );

    // Tell the client the proof photo arrived.
    if (order.clientId) {
      await notify({
        userId: order.clientId,
        title: type === 'BEFORE' ? 'Photo avant lavage 📸' : 'Photo après lavage 📸',
        message: type === 'BEFORE'
          ? `Le laveur a photographié votre voiture avant le lavage « ${order.service?.name || ''} ».`
          : `Le lavage « ${order.service?.name || ''} » est terminé — photo du résultat envoyée.`,
        type: 'order',
        data: { orderId: order.id, orderNumber: order.orderNumber, photoType: type },
      });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Upload photo error:', error);
    return NextResponse.json(
      { success: false, error: 'Échec de l\u2019enregistrement de la photo' },
      { status: 500 }
    );
  }
}
