// Commission rates — concept doc "Key Decisions" / TRD 3.1.2: 12% standard,
// 5% for Braidr Pro subscribers. Always computed server-side from the
// service's stored price and the braider's current Pro subscription state —
// never trust a client-submitted amount.
const STANDARD_COMMISSION_RATE = 0.12;
const PRO_COMMISSION_RATE = 0.05;

export type BookingPricing = {
  amount_pence: number;
  commission_pence: number;
  braider_payout_pence: number;
};

/**
 * `price_from` is what's charged. Services may also carry a `price_to` for
 * range display ("from £80"), but nothing in the PRD/TRD describes an
 * interactive negotiation step between browsing and booking — booking at
 * the advertised "from" price is the only well-defined behaviour, so that's
 * what's charged.
 */
export function computeBookingPricing(
  servicePriceFromPence: number,
  braiderIsProSubscribed: boolean
): BookingPricing {
  const rate = braiderIsProSubscribed ? PRO_COMMISSION_RATE : STANDARD_COMMISSION_RATE;
  const amount_pence = servicePriceFromPence;
  const commission_pence = Math.round(amount_pence * rate);
  const braider_payout_pence = amount_pence - commission_pence;
  return { amount_pence, commission_pence, braider_payout_pence };
}
