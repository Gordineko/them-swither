// helpers/orderNumber.js
import Settings from "../models/admin/Settings.js";

export const ORDER_ID_KEY = "orderId";

export async function getNextOrderNumber(base = 1_000_000) {
  // ВАЖНО: используем модель (а не raw collection) и 'new: true' для совместимости
  const doc = await Settings.findOneAndUpdate(
    { key: ORDER_ID_KEY },
    [
      {
        $set: {
          value: { $add: [ { $toLong: { $ifNull: ["$value", base] } }, 1 ] },
          key: ORDER_ID_KEY,
          createdAt: { $ifNull: ["$createdAt", new Date()] },
          updatedAt: new Date(),
        },
      },
    ],
    { upsert: true, new: true } // new: true == returnDocument: "after"
  ).lean();

  const val = doc?.value;
  if (val == null || Number.isNaN(Number(val))) {
    // НЕ возвращаем пустую строку — бросаем, чтобы контроллер сделал fallback
    throw new Error("OrderNumberNotGenerated");
  }
  return Number(val); // возвращаем число
}
