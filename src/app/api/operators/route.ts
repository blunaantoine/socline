import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Récupérer tous les opérateurs (public: uniquement actifs, admin: tous)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const operators = await db.mobileMoneyOperator.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      operators
    });
  } catch (error) {
    console.error('Error fetching operators:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des opérateurs' },
      { status: 500 }
    );
  }
}

// POST - Créer ou mettre à jour un opérateur (admin seulement)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, name, displayName, ussdPattern, recipientNumber, color, minAmount, maxAmount, isActive } = data;

    if (!name || !displayName || !ussdPattern || !recipientNumber || !color) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Valider le pattern USSD — deux formats acceptés :
    //  - transfert vers un numéro : *145*1*{montant}*{numero}*2#
    //  - paiement marchand : *145*5*{montant}*1416831# (pas de {numero}, le
    //    code marchand de la plateforme est écrit en dur dans le pattern)
    if (!ussdPattern.includes('{montant}') || !ussdPattern.trim().endsWith('#')) {
      return NextResponse.json(
        { success: false, error: 'Le pattern USSD doit contenir {montant} et se terminer par #' },
        { status: 400 }
      );
    }

    let operator;

    if (id) {
      // Mise à jour
      operator = await db.mobileMoneyOperator.update({
        where: { id },
        data: {
          name,
          displayName,
          ussdPattern,
          recipientNumber,
          color,
          minAmount: minAmount || 100,
          maxAmount: maxAmount || 500000,
          isActive: isActive ?? true
        }
      });
    } else {
      // Création
      operator = await db.mobileMoneyOperator.create({
        data: {
          name,
          displayName,
          ussdPattern,
          recipientNumber,
          color,
          minAmount: minAmount || 100,
          maxAmount: maxAmount || 500000,
          isActive: isActive ?? true
        }
      });
    }

    return NextResponse.json({
      success: true,
      operator
    });
  } catch (error: any) {
    console.error('Error saving operator:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Un opérateur avec ce nom existe déjà' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde de l\'opérateur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un opérateur (admin seulement)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requis' },
        { status: 400 }
      );
    }

    await db.mobileMoneyOperator.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Opérateur supprimé'
    });
  } catch (error) {
    console.error('Error deleting operator:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de l\'opérateur' },
      { status: 500 }
    );
  }
}
