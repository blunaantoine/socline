import { db } from '@/lib/db';

// Server-side promotion validation. This is the SINGLE source of truth for
// promo code pricing: the client may *preview* a discount, but the final
// discount applied to an order is ALWAYS recomputed here (never read from
// the request body).
//
// Rules enforced:
// - code exists, is active, and the current date is inside its validity window
// - global usage limit (maxUses / currentUses)
// - per-user usage limit (maxUsesPerUser) — counted from non-cancelled orders
//   that were created with this code (no dedicated PromotionUsage table)
// - minimum order amount (minOrderAmount)
// - discount is capped at the order amount (a promo can never make an order
//   negative)

export interface ValidatedPromotion {
  id: string;
  name: string;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
}

export type PromoValidationResult =
  | { valid: true; promotion: ValidatedPromotion; discountAmount: number }
  | { valid: false; error: string };

export async function validatePromotionCode(
  code: string,
  userId: string,
  orderAmount: number
): Promise<PromoValidationResult> {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, error: 'Code promo requis' };
  }

  const amount = Number(orderAmount) || 0;
  const now = new Date();

  const promotion = await db.promotion.findFirst({
    where: {
      code: normalizedCode,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  if (!promotion) {
    return { valid: false, error: 'Code promo invalide ou expiré' };
  }

  // Global usage limit.
  if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
    return { valid: false, error: "Ce code promo a atteint sa limite d'utilisation" };
  }

  // Per-user usage limit: count non-cancelled orders already placed with
  // this code by this user.
  const previousUses = await db.order.count({
    where: {
      clientId: userId,
      promoCode: normalizedCode,
      status: { not: 'CANCELLED' },
    },
  });
  if (previousUses >= promotion.maxUsesPerUser) {
    return { valid: false, error: 'Vous avez déjà utilisé ce code promo' };
  }

  // Minimum order amount.
  if (promotion.minOrderAmount && amount < promotion.minOrderAmount) {
    return {
      valid: false,
      error: `Montant minimum: ${promotion.minOrderAmount.toLocaleString('fr-FR')} XOF`,
    };
  }

  // Compute the discount, capped at the order amount.
  let discountAmount =
    promotion.discountType === 'PERCENTAGE'
      ? Math.round((amount * promotion.discountValue) / 100)
      : promotion.discountValue;
  discountAmount = Math.max(0, Math.min(discountAmount, amount));

  return {
    valid: true,
    promotion: {
      id: promotion.id,
      name: promotion.name,
      code: promotion.code ?? normalizedCode,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      discountAmount,
    },
    discountAmount,
  };
}
