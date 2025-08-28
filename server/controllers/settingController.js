// controllers/settings.controller.js
import Settings from "../models/admin/Settings.js";

const ORDER_ID_KEY = "orderId";

// helper: приводим к числу
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /admin/api/settings/order-id
 * Возвращает текущее значение ключа orderId
 */
export const getOrderId = async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: ORDER_ID_KEY }).lean();
    return res.status(200).json({
      key: ORDER_ID_KEY,
      value: doc ? doc.value : null,
      exists: !!doc,
    });
  } catch (e) {
    console.error("[getOrderId] error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /admin/api/settings/order-id
 * body: { value: number }
 * Жёстко выставляет значение orderId (upsert)
 */
export const setOrderId = async (req, res) => {
  try {
    const n = toNumber(req.body?.value);
    if (n === null) {
      return res.status(400).json({ message: "value must be a number" });
    }

    const doc = await Settings.findOneAndUpdate(
      { key: ORDER_ID_KEY },
      { $set: { key: ORDER_ID_KEY, value: n } },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({ key: ORDER_ID_KEY, value: doc.value });
  } catch (e) {
    console.error("[setOrderId] error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /admin/api/settings/order-id/next
 * body: { step?: number, start?: number }
 * Атомарно инкрементит значение и возвращает новое.
 * Если запись не существует — создаст со значением `start` (по умолчанию 1).
 */
export const nextOrderId = async (req, res) => {
  try {
    const step = toNumber(req.body?.step ?? 1) ?? 1;
    const start = toNumber(req.body?.start ?? 1) ?? 1;

    // если записи нет — при upsert выставим value = start - step, чтобы после $inc получить start
    const doc = await Settings.findOneAndUpdate(
      { key: ORDER_ID_KEY },
      {
        $inc: { value: step },
        $setOnInsert: { key: ORDER_ID_KEY, value: start - step },
      },
      {
        new: true,
        upsert: true,
        projection: { _id: 0, key: 1, value: 1 },
      }
    ).lean();

    // защита: если в БД лежало не число
    if (typeof doc.value !== "number") {
      return res.status(409).json({
        message:
          "orderId stored value is not a number; set it explicitly via PUT /order-id",
        current: doc.value,
      });
    }

    return res.status(200).json({ key: ORDER_ID_KEY, value: doc.value });
  } catch (e) {
    console.error("[nextOrderId] error:", e);
    return res.status(500).json({ message: "Server error" });
  }
};
