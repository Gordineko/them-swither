// utils/cartTotals.js
export const calculateTotals = (items) => {
  // Сумма всех количеств
  const totalQuantity = items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  // Сумма всех цен с учётом количества
  const totalPrice = items.reduce((sum, item) => {
    // Если есть вариации и у первой вариации указана price — берём её,
    // иначе fallback на cost
    const unitPrice =
      item.variations?.variations?.[0]?.price ?? item.cost ?? 0;
    return sum + unitPrice * (item.quantity || 0);
  }, 0);

  return { totalQuantity, totalPrice };
};
