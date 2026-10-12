import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET  /api/admin/support-tickets          — liste des demandes de support
// PATCH /api/admin/support-tickets         — change le statut d'un ticket
//
// GET  ?status=OPEN|IN_PROGRESS|RESOLVED|ALL  &page=1 &limit=50
// PATCH body : { id, status, adminNotes? }

const ALLOWED_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where =
      status !== 'ALL' && ALLOWED_STATUSES.includes(status) ? { status } : {};

    const [tickets, total, openCount] = await Promise.all([
      db.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
      }),
      db.supportTicket.count({ where }),
      db.supportTicket.count({ where: { status: 'OPEN' } }),
    ]);

    return NextResponse.json({ success: true, tickets, total, openCount });
  } catch (error) {
    console.error('Get support tickets error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json().catch(() => null);
    const { id, status, adminNotes } = body ?? {};
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }
    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const ticket = await db.supportTicket.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error('Update support ticket error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
