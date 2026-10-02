import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { emitRealtime } from '@/lib/realtime';

// Keep at most MAX_KEPT WASHER_LOCATION tracking events per order.
const MAX_KEPT = 50;

// POST /api/orders/[id]/location
// Washer live-location sharing during a job. Authenticated washer (session
// cookie) pushes its GPS position; the point is persisted as a TrackingEvent
// and pushed in real time to the order room via the socket mini-service.
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

    if (session.role !== 'WASHER') {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Order.washerId stores the Washer RECORD id — resolve the session user
    // to their washer record (id or userId are both accepted).
    const washer = await db.washer.findFirst({
      where: { OR: [{ id: session.id }, { userId: session.id }] },
    });
    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { latitude, longitude } = body ?? {};

    // Validate coordinates: finite numbers within the valid ranges.
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return NextResponse.json(
        { success: false, error: 'Coordonnées invalides' },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, washerId: true, status: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Only the assigned washer may share the position of this order.
    if (order.washerId !== washer.id) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Sharing makes sense while the washer is on the way or on site —
    // never for PENDING (unassigned) or terminal states.
    if (!['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Position non partageable pour ce statut' },
        { status: 400 }
      );
    }

    // Persist the tracking point.
    await db.trackingEvent.create({
      data: {
        orderId: order.id,
        event: 'WASHER_LOCATION',
        latitude: lat,
        longitude: lng,
        message: null,
      },
    });

    // Housekeeping: keep only the latest MAX_KEPT points for this order.
    const cutoff = await db.trackingEvent.findMany({
      where: { orderId: order.id, event: 'WASHER_LOCATION' },
      orderBy: { createdAt: 'desc' },
      skip: MAX_KEPT,
      take: 1,
      select: { createdAt: true },
    });
    if (cutoff.length > 0) {
      await db.trackingEvent.deleteMany({
        where: {
          orderId: order.id,
          event: 'WASHER_LOCATION',
          createdAt: { lt: cutoff[0].createdAt },
        },
      });
    }

    // Realtime push to the order room (client tracking screen).
    emitRealtime(['order:' + order.id], 'washer-location', {
      orderId: order.id,
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order location error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record location' },
      { status: 500 }
    );
  }
}
