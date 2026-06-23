export const SHIPPING_FEE = 12.99;
export const COLLECTION_POINT_FEE = 5.99;

export function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "$0.00";
  }
  return `$${amount.toFixed(2)}`;
}
