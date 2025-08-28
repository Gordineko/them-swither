export function getAccumulatedDiscount(totalSpent) {
  if (totalSpent >= 45000) return 10;
  if (totalSpent >= 30000) return 7;
  if (totalSpent >= 20000) return 5;
  if (totalSpent >= 4500) return 2;
  return 0;
}