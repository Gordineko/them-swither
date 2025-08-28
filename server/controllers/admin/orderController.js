import { User } from "../../models/User.js";
import { Order } from "../../models/User.js"; // Импортируем модель Order, если она используется отдельно
import mongoose from "mongoose";

const KEYCRM_URL = 'https://openapi.keycrm.app/v1/order';
const KEYCRM_TOKEN = 'YzE2NmNjMTI1ODE3ZjdkOTAyY2NjNjU2ODk2NWZhNDkwNmM0ZTA5OQ';

function esc(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return false;
}const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function parseSort(sort) {
  if (!sort) return { ordered_at: -1 };
  const fields = String(sort)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const obj = {};
  for (const f of fields) {
    if (f.startsWith("-")) obj[f.slice(1)] = -1;
    else if (f.startsWith("+")) obj[f.slice(1)] = 1;
    else obj[f] = 1;
  }
  return Object.keys(obj).length ? obj : { ordered_at: -1 };
}

function buildFlexPhoneRegexString(digits) {
  return digits.split("").join("\\D*");
}

export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      q,                 // пошук: №, ПІБ, телефон, SKU, назва
      status,            // "Новий" | "Прийнят" | ...
      isPaid,            // "true"/"false" | "1"/"0"
      method,            // "cash" | "card" | "iban" | "cod"
      from,              // ISO початок (вкл.)
      to,                // ISO кінець (вкл.)
      sort = "-ordered_at",
      deleted,           // '', 'include', 'only'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * lim;

    const search = (q || "").trim();
    const sortObj = parseSort(sort);

    // --- Фільтр для Order ---
    const filter = {};

    // Управление видимостью удалённых:
    // - default (undefined/empty): только НЕ удалённые (isDeleted != true)
    // - deleted=include: показывать всё (ничего не добавляем)
    // - deleted=only: только удалённые (isDeleted === true)
    if (deleted === 'only') {
      filter.isDeleted = true;
    } else if (deleted === 'include') {
      // ничего не добавляем
    } else {
      filter.isDeleted = { $ne: true };
    }

    if (status) filter.status = status;
    if (method) filter["payment.method"] = method;

    // --- Фільтр "Сплачено/Не сплачено" ---
    if (typeof isPaid !== "undefined") {
      const paid = toBool(isPaid);
      filter.$and = filter.$and || [];
      if (paid) {
        filter.$and.push({
          $or: [
            { "payment.isPaid": true },
            { status: "Оплачено" },
          ],
        });
      } else {
        filter.$and.push({
          $and: [
            {
              $or: [
                { "payment.isPaid": { $exists: false } },
                { "payment.isPaid": { $ne: true } },
              ],
            },
            { status: { $ne: "Оплачено" } },
          ],
        });
      }
    }

    // --- Діапазон дат ---
    if (from || to) {
      filter.ordered_at = {};
      if (from) filter.ordered_at.$gte = new Date(from);
      if (to) filter.ordered_at.$lte = new Date(to);
    }

    // --- Пошук ---
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);

      const tokenConds = tokens.map((t) => {
        const rx = new RegExp(esc(t), "i");
        return {
          $or: [
            { order_number: rx },
            { "customer.firstname": rx },
            { "customer.lastname": rx },
            { "products.title.ua": rx },
            { "products.title.ru": rx },
            { "products.variations.variations.sku": rx },
            { "products.manualSearchTags": rx },
          ],
        };
      });

      const phoneDigits = search.replace(/[^\d]+/g, "");
      const phoneOr = [];
      if (phoneDigits.length >= 6) {
        const flex = buildFlexPhoneRegexString(phoneDigits);
        phoneOr.push({ "customer.phone": { $regex: flex, $options: "i" } });
      }

      const bigOr = [];
      if (tokenConds.length) bigOr.push({ $and: tokenConds });
      if (phoneOr.length) bigOr.push(...phoneOr);

      if (bigOr.length) {
        filter.$and = (filter.$and || []).concat([{ $or: bigOr }]);
      }
    }

    // --- Проєкція під таблицю ---
    const projection = {
      order_number: 1,
      products: 1,
      status: 1,
      payment: 1,
      isPartner: 1,
      customer: 1,
      delivery: 1,
      ordered_at: 1,
      createdAt: 1,
      isDeleted: 1,
      deletedAt: 1,
      deletedBy: 1,
    };

    // === Основний шлях: окрема колекція Order ===
    if (Order && Order.find) {
      const [items, total] = await Promise.all([
        Order.find(filter)
          .select(projection)
          .sort(sortObj)
          .skip(skip)
          .limit(lim)
          .lean(),
        Order.countDocuments(filter),
      ]);
      return res.status(200).json({ items, total, page: pageNum, limit: lim });
    }

    // === Fallback (если у вас когда-то были заказы в User.orders) ===
    const users = await User.find({}, "orders").lean();
    let all = [];
    for (const u of users) {
      for (const o of (u.orders || [])) {
        all.push({ ...o, userId: u._id });
      }
    }

    const tokens = search ? search.split(/\s+/).filter(Boolean) : [];
    const phoneDigitsQuery = search ? search.replace(/[^\d]+/g, "") : "";

    const pass = (o) => {
      // учёт deleted
      const docDeleted = !!o.isDeleted;
      if (deleted === 'only') {
        if (!docDeleted) return false;
      } else if (deleted === 'include') {
        // ok
      } else {
        if (docDeleted) return false; // default: скрываем удалённые
      }

      if (status && o.status !== status) return false;
      if (method && o?.payment?.method !== method) return false;

      if (typeof isPaid !== "undefined") {
        const paid = toBool(isPaid);
        const flag =
          o?.payment?.isPaid != null ? !!o.payment.isPaid : (o.status === "Оплачено");
        if (paid) {
          if (!(flag === true || o.status === "Оплачено")) return false;
        } else {
          if (flag === true || o.status === "Оплачено") return false;
        }
      }

      const ts = new Date(o.ordered_at || o.createdAt || 0).getTime();
      if (from && ts < new Date(from).getTime()) return false;
      if (to && ts > new Date(to).getTime()) return false;

      if (search) {
        const matchesToken = (t) => {
          const rx = new RegExp(esc(t), "i");
          const skuList = (o.products || [])
            .flatMap((p) => (p?.variations?.variations || []).map((v) => v?.sku))
            .filter(Boolean);
          const titles = (o.products || [])
            .flatMap((p) => [p?.title?.ua, p?.title?.ru])
            .filter(Boolean);
          const tags = (o.products || []).flatMap((p) => p?.manualSearchTags || []);

        return (
            rx.test(o.order_number || "") ||
            rx.test(o?.customer?.firstname || "") ||
            rx.test(o?.customer?.lastname || "") ||
            titles.some((ti) => rx.test(ti)) ||
            skuList.some((s) => rx.test(s)) ||
            tags.some((tg) => rx.test(tg))
          );
        };

        const tokensOk = tokens.length ? tokens.every(matchesToken) : false;

        let phoneOk = false;
        if (phoneDigitsQuery.length >= 6) {
          const phoneDigitsDoc = (o?.customer?.phone || "").replace(/[^\d]+/g, "");
          phoneOk = phoneDigitsDoc.includes(phoneDigitsQuery);
        }

        if (!(tokensOk || phoneOk)) return false;
      }

      return true;
    };

    const sortKeys = Object.entries(sortObj);
    const cmp = (a, b) => {
      for (const [k, dir] of sortKeys) {
        const av = k.split(".").reduce((x, p) => (x ? x[p] : undefined), a);
        const bv = k.split(".").reduce((x, p) => (x ? x[p] : undefined), b);
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av > bv) return dir;
        if (av < bv) return -dir;
      }
      return 0;
    };

    const filtered = all.filter(pass).sort(cmp);
    const total = filtered.length;
    const items = filtered.slice(skip, skip + lim);

    return res.status(200).json({ items, total, page: pageNum, limit: lim });
  } catch (err) {
    console.error("getAllOrders: Error occurred:", err);
    return res.status(500).json({ message: err.message });
  }
};

// Получить все заказы для пользователя
export const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Получить конкретный заказ пользователя
export const getOrderForUserById = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const order = user.orders.id(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/** Повертає один заказ для сторінки редагування */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid order id" });

    // 1) Основний шлях: окрема колекція Order
    if (Order && Order.findById) {
      const doc = await Order.findById(id).lean();
      if (!doc) return res.status(404).json({ message: "Order not found" });
      return res.status(200).json(doc);
    }

    // 2) Fallback: замовлення зберігаються у User.orders
    const user = await User.findOne({ "orders._id": id }).select({ "orders.$": 1 }).lean();
    if (!user || !user.orders?.length) return res.status(404).json({ message: "Order not found" });

    const order = user.orders[0];
    // для зручності UI віддамо userId
    return res.status(200).json({ ...order, userId: user._id });
  } catch (err) {
    console.error("[getOrderById] Error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// Создать новый заказ для пользователя
export const createOrder = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    // Добавляем новый заказ в массив orders
    user.orders.push(req.body);
    await user.save();
    // Возвращаем только что созданный заказ
    const newOrder = user.orders[user.orders.length - 1];
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Обновить заказ пользователя
export const updateUserOrder = async (req, res) => {
  try {
    console.debug("updateOrder: Received params:", req.params);
    console.debug("updateOrder: Received body:", req.body);

    const { userId, orderId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      console.debug("updateOrder: User not found with id:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    const order = user.orders.id(orderId);
    if (!order) {
      console.debug("updateOrder: Order not found with id:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    console.debug("updateOrder: Order before update:", order);
    // Обновляем поля заказа (order.set обновляет только указанные поля)
    order.set(req.body);
    console.debug("updateOrder: Order after update:", order);

    await user.save();
    console.debug("updateOrder: User saved successfully");

    res.json(order);
  } catch (err) {
    console.error("updateOrder: Error occurred:", err);
    res.status(400).json({ message: err.message });
  }
};


// Удалить заказ пользователя
export const deleteUserOrder = async (req, res) => {
  try {
    console.debug("deleteOrder: Received request with params:", req.params);
    const { userId, orderId } = req.params;

    const user = await User.findById(userId);
    console.debug("deleteOrder: Fetched user:", user);
    if (!user) {
      console.error("deleteOrder: User not found for userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    const order = user.orders.id(orderId);
    console.debug("deleteOrder: Fetched order:", order);
    if (!order) {
      console.error("deleteOrder: Order not found for orderId:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    user.orders = user.orders.filter(
      promo => promo._id.toString() !== orderId
    );
    await user.save();
    console.debug("deleteOrder: Order removed and user saved successfully.");

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("deleteOrder: Error occurred:", err);
    res.status(500).json({ message: err.message });
  }
};


// export const updateOrder = async (req, res) => {
//   try {
//     const { userId, orderId, id } = req.params;

//     // Определяем целевой orderId
//     const targetId = orderId || id;

//     let order_number = null;

//     // Удаляем запрещённые к обновлению поля
//     const safeBody = { ...req.body };
//     delete safeBody._id;
//     delete safeBody.__v;

//     // 1. Если есть userId — ищем заказ внутри пользователя
//     if (userId) {
//       const user = await User.findById(userId);
//       if (!user) {
//         return res.status(404).json({ message: 'User not found' });
//       }

//       const userOrder = user.orders.id(targetId);
//       if (!userOrder) {
//         return res.status(404).json({ message: 'Order not found in user' });
//       }

//       order_number = userOrder.order_number;

//       // Обновляем вложенный заказ
//       userOrder.set(safeBody);
//       await user.save();

//       // Обновляем глобальный заказ с тем же order_number
//       const globalOrder = await Order.findOne({ order_number });
//       if (globalOrder) {
//         Object.keys(safeBody).forEach(key => {
//           globalOrder[key] = safeBody[key];
//         });
//         await globalOrder.save();
//       }

//       return res.json(userOrder);
//     }

//     // 2. Если userId нет — работаем с глобальной коллекцией
//     const globalOrder = await Order.findById(targetId);
//     if (!globalOrder) {
//       return res.status(404).json({ message: 'Order not found' });
//     }

//     order_number = globalOrder.order_number;

//     // Обновляем глобальный заказ
//     Object.keys(safeBody).forEach(key => {
//       globalOrder[key] = safeBody[key];
//     });
//     await globalOrder.save();

//     // Обновляем вложенный заказ у пользователя (если такой есть)
//     const user = await User.findOne({ 'orders.order_number': order_number });
//     if (user) {
//       const userOrder = user.orders.find(o => o.order_number === order_number);
//       if (userOrder) {
//         userOrder.set(safeBody);
//         await user.save();
//       }
//     }

//     return res.json(globalOrder);
//   } catch (err) {
//     console.error('updateOrder error:', err);
//     return res.status(400).json({ message: err.message });
//   }
// };


// Удаление заказа по его ID
// src/controllers/orderController.js (удаление без привязки к пользователю)
export const deleteOrder = async (req, res) => {
  try {
    const { userId, orderId, id } = req.params;
    const targetId = orderId || id;

    let order_number = null;

    // 1. Если есть userId — сначала удаляем вложённый заказ у пользователя
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userOrder = user.orders.id(targetId);
      if (!userOrder) {
        return res.status(404).json({ message: 'Order not found in user' });
      }

      order_number = userOrder.order_number;
      // Удаляем вложённый заказ через фильтрацию
      user.orders = user.orders.filter(o => o._id.toString() !== targetId);
      await user.save();

      // Затем удаляем глобальный заказ по тому же order_number
      await Order.deleteOne({ order_number });
      return res.json({ message: `Order ${order_number} deleted successfully` });
    }

    // 2. Если нет userId — работаем с глобальной коллекцией
    // Пытаемся найти по _id
    let orderDoc = null;
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      orderDoc = await Order.findById(targetId);
    }
    // Если не нашли по _id — ищем по order_number
    if (!orderDoc) {
      orderDoc = await Order.findOne({ order_number: targetId });
    }
    if (!orderDoc) {
      return res.status(404).json({ message: `Order '${targetId}' not found` });
    }

    order_number = orderDoc.order_number;
    // Удаляем глобальный заказ
    await Order.deleteOne({ _id: orderDoc._id });

    // Удаляем вложённый заказ у любого пользователя, если есть
    const owner = await User.findOne({ 'orders.order_number': order_number });
    if (owner) {
      owner.orders = owner.orders.filter(o => o.order_number !== order_number);
      await owner.save();
    }

    return res.json({ message: `Order ${order_number} deleted successfully` });
  } catch (err) {
    console.error('deleteOrder error:', err);
    return res.status(500).json({ message: err.message });
  }
};


const ORDER_STATUS_SET = new Set(["Новий", "Прийнят", "Виконано", "Відмінено", "Оформлено", "Оплачено"]);

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

// Оставляем только разрешённые поля
function sanitizePatch(input = {}) {
  const out = {};
  const { status, payment, customer, delivery, managerComment, isPartner, products, totalCost, totalCostWithoutDiscount } = input;

  if (status && typeof status === "string") {
    // Разрешаем только известные, либо пропускаем как есть — уберите проверку, если хотите позволить любые
    out.status = ORDER_STATUS_SET.has(status) ? status : status; // при желании можно жёстко ограничить
  }

  if (isObject(payment)) {
    out.payment = {};
    if (typeof payment.isPaid === "boolean") out.payment.isPaid = payment.isPaid;
    if (typeof payment.method === "string") out.payment.method = payment.method; // "cash" | "card" | "iban" | "cod"
    if (typeof payment.promo === "string") out.payment.promo = payment.promo;
    if (typeof payment.comment === "string") out.payment.comment = payment.comment;
  }

  if (isObject(customer)) {
    out.customer = {};
    if (typeof customer.firstname === "string") out.customer.firstname = customer.firstname;
    if (typeof customer.lastname === "string") out.customer.lastname = customer.lastname;
    if (typeof customer.phone === "string") out.customer.phone = customer.phone;
  }

  if (isObject(delivery)) {
    out.delivery = {};
    for (const k of [
      "type",
      "area", "areaName",
      "city", "cityName",
      "warehouse", "warehouseName",
      "address",
      "branch"
    ]) {
      if (delivery[k] !== undefined) out.delivery[k] = delivery[k] ?? "";
    }
  }

  if (typeof managerComment === "string") out.managerComment = managerComment;
  if (typeof isPartner === "boolean") out.isPartner = isPartner;

  // При необходимости разрешаем полную замену products (осторожно)
  if (Array.isArray(products)) out.products = products;

  if (typeof totalCost === "number") out.totalCost = totalCost;
  if (typeof totalCostWithoutDiscount === "number") out.totalCostWithoutDiscount = totalCostWithoutDiscount;

  return out;
}

// Плоские пути для $set: { a: {b:1} } -> { "a.b": 1 }
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) Object.assign(out, flatten(v, path));
    else out[path] = v;
  }
  return out;
}

export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { syncPayment } = req.query;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid order id" });

    const patchInput = sanitizePatch(req.body || {});
    const doSync = syncPayment === "1" || syncPayment === "true" || syncPayment === true;

    // 1) Локально: если нужно — синхронизируем статус/оплату
    if (doSync) {
      if (patchInput?.payment?.isPaid === true && !patchInput.status) {
        patchInput.status = "Оплачено";
      }
      if (patchInput?.status === "Оплачено") {
        patchInput.payment = { ...(patchInput.payment || {}), isPaid: true };
      }
    }

    // 2) Пробуем путь с отдельной коллекцией Order
    let updatedOrder = null;
    if (Order && Order.findByIdAndUpdate) {
      updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $set: { ...patchInput, updatedAt: new Date() } },
        { new: true, runValidators: true }
      );
      if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    } else {
      // 2b) Fallback: embedded в User.orders
      const user = await User.findOne({ "orders._id": id }).select({ "orders.$": 1 });
      if (!user) return res.status(404).json({ message: "Order not found" });

      const setObj = flatten(patchInput, "orders.$");
      setObj["orders.$.updatedAt"] = new Date();

      const updRes = await User.updateOne({ "orders._id": id }, { $set: setObj });
      if (updRes.matchedCount === 0) return res.status(404).json({ message: "Order not found" });

      const fresh = await User.findOne({ "orders._id": id }).select({ "orders.$": 1 }).lean();
      updatedOrder = fresh?.orders?.[0];
      if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
      updatedOrder.userId = fresh._id;
    }

    // 3) Готовим маппинг статуса для CRM (по твоей схеме)
    const statusMap = {
      "Новий": 1,
      "Прийнят": 4,
      "Виконано": 12,
      "Відмінено": 19,
      "Оплачено":  /* если нужен id для оплаченого, подставь */ null,
    };
    const status_id = statusMap[patchInput.status] ?? null;

    // 4) Если у заказа есть crmId — пушим апдейт в KeyCRM
    if (updatedOrder.crmId && status_id) {
      const keycrmPayload = { status_id };

      const crmResp = await fetch(`${KEYCRM_URL}/${updatedOrder.crmId}`, {
        method: 'PUT', // или 'PATCH' — как требует твой KeyCRM endpoint
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEYCRM_TOKEN}`
        },
        body: JSON.stringify(keycrmPayload)
      });

      const crmData = await crmResp.json().catch(() => ({}));
      if (!crmResp.ok) {
        console.error("[updateOrder][KeyCRM] error:", crmData);
      }
    }

    // 5) Возвращаем актуальную локальную версию
    return res.status(200).json(updatedOrder);
  } catch (err) {
    console.error("[updateOrder] Error:", err);
    return res.status(500).json({ message: err.message });
  }
};


export const updateOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { syncPayment } = req.query;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid order id" });

    const patchInput = sanitizePatch(req.body || {});
    const doSync = syncPayment === "1" || syncPayment === "true" || syncPayment === true;

    // Опціональна синхронізація статусу та оплати
    if (doSync) {
      if (patchInput?.payment?.isPaid === true && !patchInput.status) {
        patchInput.status = "Оплачено";
      }
      if (patchInput?.status === "Оплачено") {
        patchInput.payment = { ...(patchInput.payment || {}), isPaid: true };
      }
    }

    // ---- 1) Основний шлях: окрема колекція Order
    let updatedOrder = null;
    if (Order && Order.findById) {
      updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $set: { ...patchInput, updatedAt: new Date() } },
        { new: true, runValidators: true }
      );
      if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    } else {
      // ---- 2) Fallback: вбудований масив User.orders
      const exists = await User.findOne({ "orders._id": id }).select({ _id: 1 }).lean();
      if (!exists) return res.status(404).json({ message: "Order not found" });

      const setObj = flatten(patchInput, "orders.$");
      setObj["orders.$.updatedAt"] = new Date();

      const updRes = await User.updateOne({ "orders._id": id }, { $set: setObj });
      if (updRes.matchedCount === 0) return res.status(404).json({ message: "Order not found" });

      const fresh = await User.findOne({ "orders._id": id }).select({ "orders.$": 1 }).lean();
      updatedOrder = fresh?.orders?.[0];
      if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
      updatedOrder.userId = fresh._id; // зручно для UI
    }

    // ---- 3) Пуш статусу в KeyCRM (якщо відомий crmId та є мапа статусу)
    const statusMap = {
      "Новий": 1,
      "Прийнят": 4,
      "Виконано": 12,
      "Відмінено": 19,
      // за потреби додай:
      // "Оплачено": <ID у KeyCRM>,
    };
    const nextStatus = patchInput.status;
    const status_id = nextStatus ? statusMap[nextStatus] ?? null : null;

    if (updatedOrder?.crmId && status_id) {
      try {
        const keycrmPayload = { status_id };

        const crmResp = await fetch(`${KEYCRM_URL}/${updatedOrder.crmId}`, {
          method: "PUT", // або "PATCH" — залежно від твого ендпойнту
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KEYCRM_TOKEN}`,
          },
          body: JSON.stringify(keycrmPayload),
        });

        const crmData = await crmResp.json().catch(() => ({}));
        if (!crmResp.ok) {
          console.error("[updateOrderById][KeyCRM] error:", crmData);
        }
      } catch (e) {
        console.error("[updateOrderById][KeyCRM] network error:", e?.message || e);
      }
    }

    // ---- 4) Відповідь
    return res.status(200).json(updatedOrder);
  } catch (err) {
    console.error("[updateOrderById] Error:", err);
    return res.status(500).json({ message: err.message });
  }
};

export const softDeleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const upd = {
      isDeleted: true,
      deletedAt: new Date(),
    };

    // Если у вас есть авторизация и req.user — сохраним, кто удалил
    if (req.user?._id) upd.deletedBy = req.user._id;

    const doc = await Order.findByIdAndUpdate(id, upd, { new: true });
    if (!doc) {
      return res.status(404).json({ ok: false, message: 'Замовлення не знайдено' });
    }
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[admin][orders][soft-delete] error:', e);
    res.status(500).json({ ok: false, message: 'Не вдалося видалити замовлення' });
  }
};

// (опционально) Восстановление, если пригодится
export const restoreOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Order.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null, deletedBy: null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Замовлення не знайдено' });
    res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[admin][orders][restore] error:', e);
    res.status(500).json({ ok: false, message: 'Не вдалося відновити замовлення' });
  }
};