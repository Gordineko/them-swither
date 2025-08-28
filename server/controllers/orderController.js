import mongoose from "mongoose";
import Product from "../models/Product.js";
import { User } from "../models/User.js";
import { Order } from "../models/User.js";
import liqpay from "liqpay-sdk-nodejs";
import { getAccumulatedDiscount } from "../utils/getAccumulatedDiscount.js";
import axios from "axios";
import { getNextOrderNumber } from "../utils/orderNumber.js";
import Settings from "../models/admin/Settings.js";

const KEYCRM_URL = 'https://openapi.keycrm.app/v1/order';
const KEYCRM_TOKEN = 'YzE2NmNjMTI1ODE3ZjdkOTAyY2NjNjU2ODk2NWZhNDkwNmM0ZTA5OQ';
const liqpays = new liqpay(
  "sandbox_i35313961285",
  "sandbox_yJMKbgpQ6mCGU33p5P2BgD59z6vCHpT838JOSJkO"
);

// Токен бота и chatId в коде
const botToken = '8300960022:AAEBTHzDRiWnyEXPmalMR0zbWowCxRmuufQ';
const chatId = '-1002754415555';

// Конфиг Nova Poshta
const npConfig = {
  apiKey: '6ac96c751e3eb13a5d552f8f50248575' || '',
  url: 'https://api.novaposhta.ua/v2.0/json/'
};




// Вспомогательные функции для получения названий из Nova Poshta
async function getAreaName(areaRef) {
  try {
    const { data } = await axios.post(npConfig.url, {
      apiKey: npConfig.apiKey,
      modelName: 'Address',
      calledMethod: 'getAreas',
      methodProperties: {}
    });
    const area = data.data.find(a => a.Ref === areaRef);
    return area ? area.Description : areaRef;
  } catch {
    return areaRef;
  }
}
async function getCityName(cityRef) {
  try {
    const { data } = await axios.post(npConfig.url, {
      apiKey: npConfig.apiKey,
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: {}
    });
    const city = data.data.find(c => c.Ref === cityRef);
    return city ? city.Description : cityRef;
  } catch {
    return cityRef;
  }
}
async function getWarehouseName(warehouseRef) {
  try {
    const { data } = await axios.post(npConfig.url, {
      apiKey: npConfig.apiKey,
      modelName: 'AddressGeneral',
      calledMethod: 'getWarehouses',
      methodProperties: { Ref: warehouseRef }
    });
    const wh = data.data[0];
    return wh ? wh.Description : warehouseRef;
  } catch {
    return warehouseRef;
  }
}

// Функция отправки заказа в Telegram
const sendOrderToTelegram = async (order, userId) => {
  const { orderNumber, order_number, customer, delivery, payment, totalCost, products } = order;
  const mapPayMethod =
    payment.method === "cash" ? "Готівка" :
      payment.method === "terminal" ? "Термінал" :
        payment.method === "iban" ? "Оплата на ФОП (IBAN)" :
          payment.method === "invoice" ? "Оплата по рахунку (+5%)" :
            payment.method === "cod" ? "Оплата при отриманні (наложка)" : "";

  // Формуємо заголовок
  let message = `📦 Нове замовлення №${orderNumber || order_number} ${'від клієнта'} \n\n`;

  // Дані клієнта
  message += `👤 Клієнт:\n`;
  message += `  🆔 Ім'я: ${customer.firstname} ${customer.lastname}\n`;
  message += `  📞 Телефон: ${customer.phone}\n\n`;

  // Сума замовлення
  message += `💰 Сума: ${totalCost} грн\n\n`;

  // Інформація про доставку
  message += `🚚 Доставка:\n`;
  message += `  • Тип: ${delivery.type}\n`;
  if (delivery.areaName && delivery.type !== "Самовивіз") message += `  • Область: ${delivery.areaName}\n`;
  if (delivery.cityName && delivery.type !== "Самовивіз") message += `  • Місто: ${delivery.cityName}\n`;
  if (delivery.warehouseName && delivery.type !== "Самовивіз") message += `  • Відділення: ${delivery.warehouseName}\n`;
  if (delivery.address) message += `  • Адреса: ${delivery.address}\n`;
  message += `\n`;

  // Оплата
  message += `💳 Оплата:\n`;
  message += `  • Метод: ${mapPayMethod}\n`;
  if (payment.promo) message += `  • Промокод: ${payment.promo}\n`;
  message += `\n`;

  // Список товарів
  // Список товарів
  message += `📝 Товари:\n`;
  products.forEach((p, idx) => {
    const qty = typeof p.quantity === "number" ? p.quantity : 1;
    const unit = p.unit?.ua || "";
    message += `  ${idx + 1}. ${p.title.ua} (${qty} ${unit})\n`;
  });


  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Помилка надсилання в Telegram:', err.message);
  }
};

const extractString = (field) => {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object" && field.name) return field.name;
  return "";
};

export const createOrder = async (req, res) => {
  try {
    console.log("Order body:", req.body);

    const { order_number, items, values, ...orderFields } = req.body;
    const orderProducts = items || [];

    // Получение метаданных пользователя
    const userId = req.body.userId || values?.userId;
    let userMeta = {};
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        const phone = extractString(user.number_phone) || extractString(user.phone);
        const firstname = extractString(user.firstname);
        const lastname = extractString(user.lastname);
        const email = extractString(user.email);

        userMeta = { number_phone: phone, firstname, lastname, email };
      }
    }

    // Трансформация товаров заказа
    const transformedProducts = await Promise.all(
      orderProducts.map(async ({ product }) => {
        console.log("Order product ID:", product.id);
        const dbProduct = await Product.findById(product.id);
        if (!dbProduct) {
          throw new Error(`Product with id ${product.id} not found`);
        }
        return {
          barcode: product.barcode || dbProduct.barcode,
          id: product.id,
          title: product.title,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          total: product.total,
          discountedTotal: product.discountedTotal,
          img: product.img,
          multiplicity: product.multiplicity
        };
      })
    );

    // Формируем объект заказа
    const orderData = {
      ...orderFields,
      order_number,
      products: transformedProducts,
      totalCost: Number(req.body.orderDiscountedTotal),
      ...userMeta,
    };

    console.log("Final orderData to save:", orderData);

    // Сохраняем заказ в профиле пользователя
    if (userId) {
      await User.findByIdAndUpdate(userId, { $push: { orders: orderData } });
    }

    // Сохраняем заказ в коллекции Order
    const order = new Order(orderData);
    await order.save();

    // Отправляем заказ в Telegram
    await sendOrderToTelegram({
      order_number: order.order_number || order._id,
      customer: {
        firstname: userMeta.firstname || '—',
        lastname: userMeta.lastname || '',
        phone: userMeta.number_phone || '—'
      },
      delivery: {
        type: order.deliveryType || 'Не вказано',
        areaName: order.areaName,
        cityName: order.cityName,
        warehouseName: order.warehouseName,
        address: order.address
      },
      payment: {
        method: order.payment || 'Не вказано',
        promo: order.promo
      },
      totalCost: order.totalCost,
      products: order.products
    }, userId);

    return res.status(201).json({ message: "Заказ успешно создан", data: order });
  } catch (error) {
    console.error("Ошибка при создании заказа:", error.message);
    return res.status(500).json({ message: "Не удалось создать заказ", error: error.message });
  }
};


// Создание локального заказа и отправка в Telegram


function pickVariation(item = {}) {
  const varArr = item?.variations?.variations || item?.variations || [];

  // 1) Явно передали объект вариации
  const sv = item.selectedVariation || item.variation;
  if (sv && (sv.price || sv.opt_price_uah || sv.sku || sv.code)) return sv;

  if (Array.isArray(varArr) && varArr.length) {
    // 2) Поиск по SKU / code
    const bySku = item.sku && varArr.find(v => v.sku && String(v.sku) === String(item.sku));
    if (bySku) return bySku;

    const byCode = item.code && varArr.find(v => v.code && String(v.code) === String(item.code));
    if (byCode) return byCode;

    // 3) Единственная вариация
    if (varArr.length === 1) return varArr[0];
  }

  // 4) Нет вариации — вернём null, дальше упадём на цены товара
  return null;
}

/**
 * Возвращает { unitPrice, priceLabel, appliedVariation }
 * isPartner=false -> цена из variation.price (или product.retailPrice)
 * isPartner=true  -> variation.opt_price_uah (или product.opt_cost_uah/wholesalePrice)
 */
function resolveUnitPrice(item = {}, isPartner = false) {
  const v = pickVariation(item);

  const toNumber = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  if (isPartner) {
    const fromVar = v ? toNumber(v.opt_price_uah) : 0;
    const fromProd = toNumber(item.opt_cost_uah || item.wholesalePrice);
    const unitPrice = fromVar || fromProd || 0;
    return { unitPrice, priceLabel: "опт (UAH)", appliedVariation: v };
  } else {
    const fromVar = v ? toNumber(v.price) : 0;
    const fromProd = toNumber(item.retailPrice);
    const unitPrice = fromVar || fromProd || 0;
    return { unitPrice, priceLabel: "роздріб", appliedVariation: v };
  }
}

function buildTgMessage({ orderNumber, name, phone, items, total, isPartner }) {
  const lines = [];
  lines.push(`🛒 <b>Швидке замовлення (1 клік)${isPartner ? " · ПАРТНЕР" : ""}</b>`);
  lines.push(`№ <b>${orderNumber}</b>`);
  lines.push(`👤 Ім'я: <b>${name || "—"}</b>`);
  lines.push(`📞 Телефон: <b>${phone || "—"}</b>`);
  lines.push("");
  lines.push("<b>Товари:</b>");

  items.forEach((it, i) => {
    const title = it.title?.ua || it.title?.ru || it.title || it.titleLink || "Без назви";
    const qty = Number(it.quantity) || 1;

    const { unitPrice, priceLabel, appliedVariation } = resolveUnitPrice(it, isPartner);
    const sku = appliedVariation?.sku || it.sku || "—";
    const code = appliedVariation?.code || it.code || "—";
    const sub = qty * unitPrice;

    lines.push(
      `${i + 1}) ${title}
   SKU: ${sku} | Код: ${code}
   ${qty} × ${unitPrice.toFixed(2)} грн (${priceLabel}) = ${sub.toFixed(2)} грн`
    );
  });

  lines.push("");
  lines.push(`💰 <b>Сума: ${total.toFixed(2)} грн</b>`);
  return lines.join("\n");
}

async function sendOrderToTelegramOneClick(payload) {
  const text = buildTgMessage(payload);
  await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
// Хелпер: визначити, що це схоже на одиничний item
function looksLikeItem(obj) {
  if (!obj || typeof obj !== "object") return false;
  // cигнали продукту/варіації
  return (
    "title" in obj ||
    "variations" in obj ||
    "retailPrice" in obj ||
    "_id" in obj ||
    "id" in obj ||
    "sku" in obj ||
    "code" in obj
  );
}

// Хелпер: нормалізує items у масив
function normalizeItems(items) {
  if (Array.isArray(items)) return items;

  if (items && typeof items === "object") {
    // якщо це одиничний товар
    if (looksLikeItem(items)) return [items];

    // інакше вважаємо, що це мапа {key: item}
    const arr = Object.values(items).filter(looksLikeItem);
    return arr;
  }

  return [];
}


function splitName(full = "") {
  const s = String(full).trim().replace(/\s+/g, " ");
  if (!s) return { firstname: "", lastname: "" };
  const parts = s.split(" ");
  return { firstname: parts[0] || "", lastname: parts.slice(1).join(" ") || "" };
}

// --- Маппінг 1-click item -> запис у полі products замовлення ---
function mapOneClickItemToOrderProduct(it, isPartner) {
  const qty = Number(it.quantity) || 1;
  const { unitPrice, appliedVariation } = resolveUnitPrice(it, isPartner);

  const titleUA = it.title?.ua ?? it.titleUA ?? it.title ?? "";
  const titleRU = it.title?.ru ?? it.titleRU ?? it.title ?? "";

  return {
    // заголовки
    title: { ua: titleUA, ru: titleRU },
    // sku/code на верхньому рівні (для сумісності зі старими скриптами)
    sku: appliedVariation?.sku || it.sku || "",
    code: appliedVariation?.code || it.code || "",
    // мінімальний набір для таблиці та карток
    quantity: qty,
    retailPrice: unitPrice,
    wholesalePrice: it.wholesalePrice || 0,

    // вкладені варіації (сумісно з вашою структурою)
    variations: {
      name: { ua: titleUA, ru: titleRU },
      variations: [
        {
          option: it.option
            ? { ua: it.option.ua || it.option, ru: it.option.ru || it.option }
            : undefined,
          price: unitPrice,
          opt_price: it.opt_price || 0,
          sku: appliedVariation?.sku || it.sku || "",
          code: appliedVariation?.code || it.code || "",
          quantity: it.stock ?? it.quantity ?? 0,
          img: Array.isArray(it.img)
            ? it.img
            : it.img
              ? [{ img_link: it.img, type: "image" }]
              : [],
          isVisible: true,
          type: "sale",
          characteristics: it.characteristics || [],
        },
      ],
    },

    // мінімальні службові
    id: it.id || it._id || it.productId || undefined,
    groupId: it.groupId || undefined,
    titleLink: it.titleLink || "",
    categoryLink: it.categoryLink || "",
    subcategoryLink: it.subcategoryLink || "",
    imageURL: Array.isArray(it.imageURL) ? it.imageURL : [],
    manualSearchTags: it.manualSearchTags || [],
    discountedTotal: qty * unitPrice,
    total: qty * unitPrice,
  };
}

export const createOneClickOrder = async (req, res) => {
  try {
    const { orderNumber, name, phone, items = [], isPartner = false } = req.body || {};
    const itemList = normalizeItems(items);

    if ((!orderNumber && orderNumber !== 0) && !Settings) {
      // якщо немає Settings — краще явно сказати
      return res.status(500).json({ ok: false, message: "Неможливо згенерувати номер замовлення" });
    }

    if (!name || !phone || !itemList.length) {
      return res.status(400).json({ ok: false, message: "Некоректні дані замовлення" });
    }

    // № замовлення: беремо з тіла або генеруємо
    const localOrderNumber = await getNextOrderNumber();

    // total (з урахуванням партнерства)
    const total = itemList.reduce((sum, it) => {
      const qty = Number(it.quantity) || 1;
      const { unitPrice } = resolveUnitPrice(it, isPartner);
      return sum + qty * unitPrice;
    }, 0);

    // customer
    const { firstname, lastname } = splitName(name);

    // products у форматі локальної моделі
    const products = itemList.map((it) => mapOneClickItemToOrderProduct(it, isPartner));

    // Локальний статус і оплата: 1-click — створюємо як «Новий», неоплачений
    const orderDoc = await Order.create({
      userId: null,
      order_number: localOrderNumber,
      products,
      totalCost: total,
      totalCostWithoutDiscount: total, // знижки немає на етапі 1-click, при потребі зміниться потім
      customer: { firstname, lastname, phone },
      delivery: {
        type: "oneclick", // службовий тип
        area: null, areaName: null,
        city: null, cityName: null,
        warehouse: null, warehouseName: null,
        address: "", branch: "",
      },
      payment: {
        method: "oneclick",
        promo: "",
        comment: "Замовлення в 1 клік",
        acceptPolicy: false,
        noCall: false,
        isPaid: false,
      },
      status: "Новий",
      isPartner: !!isPartner,
      ordered_at: new Date(),
    });

    // 1) Telegram
    try {
      await sendOrderToTelegramOneClick({
        orderNumber: localOrderNumber,
        name,
        phone,
        items: itemList,
        total,
        isPartner,
      });
    } catch (e) {
      console.error("[OneClick][Telegram] error:", e?.message || e);
    }

    // 2) KeyCRM — тільки дані з запиту + помітка менеджеру
    const keycrmProducts = itemList.map((it) => {
      const qty = Number(it.quantity) || 1;
      const { unitPrice, appliedVariation } = resolveUnitPrice(it, isPartner);
      return {
        title: it.title?.ru || it.title?.ua || it.title || it.titleLink || "Без назви",
        sku: appliedVariation?.sku || it.sku || "",
        quantity: qty,
        price: unitPrice,
      };
    });

    const keycrmPayload = {
      source_id: 3,
      externalId: String(localOrderNumber),
      source_uuid: String(localOrderNumber),
      buyer: {
        full_name: name || "",
        phone: phone || "",
      },
      products: keycrmProducts,
      payments: [
        {
          status: "not_paid",
          amount: total,
          payment_method: isPartner ? "Партнерська ціна" : "Готівка/безготівка",
        },
      ],
      manager_comment: "Замовлення в 1 клік",
    };

    try {
      const resp = await fetch(KEYCRM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KEYCRM_TOKEN}`,
        },
        body: JSON.stringify(keycrmPayload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("[OneClick][KeyCRM] Error:", data);
      } else if (data?.id) {
        // збережемо crmId у локальному замовленні
        orderDoc.crmId = data.id;
        await orderDoc.save();
      }
    } catch (e) {
      console.error("[OneClick][KeyCRM] Network error:", e?.message || e);
    }

    return res.status(200).json({
      ok: true,
      orderNumber: localOrderNumber,
      total,
      isPartner: !!isPartner,
      data: orderDoc,
    });
  } catch (err) {
    console.error("[OneClick] Помилка:", err?.response?.data || err?.message || err);
    return res.status(500).json({ ok: false, message: "Внутрішня помилка сервера" });
  }
};


const OFFLINE_METHODS = ["cash", "terminal", "iban", "invoice", "cod"];

export const createLocalOrder = async (req, res, next) => {
  try {
    const {
      items,
      values = {},
      userId,
      orderNumber,     // может прийти с фронта; если нет — сгенерируем
      isPartner,
      ...orderFields
    } = req.body;

    const {
      name,
      surname,
      phone,
      deliveryType,
      area,
      city,
      warehouse,
      courierAddress: address,
      branch,
      payment,
      promo,
      comment,
      acceptPolicy,
      noCall,
      totalCost,
      totalCostWithoutDiscount,
    } = values;

    // 1) Готовим человекочитаемые названия НП
    const [areaName, cityName, warehouseName] = await Promise.all([
      getAreaName(area),
      getCityName(city),
      getWarehouseName(warehouse),
    ]);

    // 2) Номер заказа: берём из запроса или генерим на бэке
    const orderNum = await getNextOrderNumber();

    // 3) Базовый статус и оплата
    const status = "Новий";
    const isPaid = false; // при создании ВСЕГДА false

    console.log(values)

    // 4) Собираем локальный заказ
    const orderData = {
      ...orderFields,
      userId: userId || null,
      order_number: orderNum,
      products: items?.cartItems || [],
      totalCost,
      totalCostWithoutDiscount,
      customer: { firstname: name, lastname: surname, phone },
      delivery: {
        type: deliveryType,
        area, areaName,
        city, cityName,
        warehouse, warehouseName,
        address, branch,
      },
      payment: { method: payment, promo, comment, acceptPolicy, noCall, isPaid },
      status,
      isPartner: !!isPartner,
      ordered_at: new Date(),
    };

    // 5) Сохраняем заказ
    const order = await Order.create(orderData);

    // 6) Денормализация в user.orders (встраиваем краткую запись)
    if (userId) {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            orders: {
              order_number: order.order_number,
              status: order.status,
              payment: { method: payment, isPaid: false },
              products: order.products,
              delivery: order.delivery,
              customer: order.customer,
              totalCost: order.totalCost,
              ordered_at: order.ordered_at,
              updatedAt: new Date(),
            },
          },
          $set: { cart: [] },
        }
      );
    }

    // 7) Списание остатков: только для офлайн методов
    if (OFFLINE_METHODS.includes(payment)) {
      for (const item of items?.cartItems || []) {
        const prod = await Product.findOne({ _id: item._id || item.productId || item.id });
        if (!prod) continue;

        const variationArr = prod?.variations?.variations || [];
        const vFromOrder = item?.variations?.variations?.[0];

        const variation = variationArr.find((v) =>
          (v._id?.toString && v._id.toString() === item?.variationId?.toString()) ||
          (vFromOrder?.sku && v.sku === vFromOrder.sku) ||
          (vFromOrder?.code && v.code === vFromOrder.code)
        );

        const qty = Number(item.quantity || 1);
        if (variation && qty > 0) {
          variation.quantity = Math.max(0, Number(variation.quantity || 0) - qty);
          await prod.save();
        }
      }
    }

    // 8) Формируем KeyCRM payload (создаём заказ там для офлайн методов)
    if (OFFLINE_METHODS.includes(payment)) {
      const keycrmProducts = (items?.cartItems || []).map((it) => ({
        productVariationId: it.id, // если у тебя есть реальный variationId в CRM — подставь его
        quantity: it.quantity,
        price: it?.variations?.variations?.[0]?.price ?? it.retailPrice ?? 0,
        sku: it?.variations?.variations?.[0]?.sku ?? it.sku ?? "",
        costPrice: it.wholesalePrice || 0,
        discountPercent: it.discount || 0,
        discountAmount: 0,
        isUpsale: false,
        title: it.title?.ru || it.title?.ua || "",
        notes: "",
        warehouseId: 1,
        taxGroup: "",
      }));

      const deliveryCommon = {
        serviceType: "DoorsDoors",
        payerType: "Sender",
        cargoType: "Parcel",
        paymentMethod: "NonCash",
        productPaymentMethod: "postpaid",
        price: totalCost,
        weight: keycrmProducts.reduce((s, p) => s + (p.quantity * (p.weight || 0)), 0),
        volumetricVolume: 0,
        seats: [],
        description: comment || "",
      };

      const keycrmDelivery =
        deliveryType === "branch"
          ? {
            ...deliveryCommon,
            type: "ukrpost",
            city: cityName,
            cityId: city,
            department: warehouseName,
            departmentId: warehouse,
          }
          : {
            ...deliveryCommon,
            type: "courier",
            street: address,
            city: cityName,
            cityId: city,
          };

      const mapPayMethod =
        payment === "cash" ? "Готівка" :
          payment === "terminal" ? "Термінал" :
            payment === "iban" ? "Оплата на ФОП (IBAN)" :
              payment === "invoice" ? "Оплата по рахунку (+5%)" :
                payment === "cod" ? "Оплата при отриманні (наложка)" : "";

      const keycrmPayload = {
        source_id: 3,
        source_uuid: String(orderNum),
        externalId: String(orderNum),
        buyer_comment: values.noCall === true ? "Передзвонити: ні" : values.noCall === false ? "Передзвонити: так" : '',
        products: keycrmProducts,
        discount_amount: Number(totalCostWithoutDiscount || 0) - Number(totalCost || 0),
        shipping: {
          delivery_service_id:
            values.deliveryType === "Meest Posht" ? 3 :
              values.deliveryType === "Самовивіз" ? "" : 1,
          shipping_service: values.shipping_service || "Нова Пошта",
          shipping_address_city: cityName || address || "",
          shipping_address_country: "Ukraine",
          shipping_address_region: areaName || "",
          shipping_receive_point: (typeof address === "string" && address.trim()) ? "" : (warehouseName || ""),
          recipient_full_name: `${name || ""} ${surname || ""}`.trim(),
          recipient_phone: phone || "",
        },
        buyer: {
          full_name: `${name || ""} ${surname || ""}`.trim(),
          phone: phone || "",
        },
        payments: [
          {
            payment_method_id: 1,
            payment_method: mapPayMethod,
            amount: totalCost,
            description: mapPayMethod,
            payment_date: "",
            status: "not_paid",
          },
        ],
        attachments: [],
        utm: {},
      };

      try {
        const crmRes = await fetch(KEYCRM_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KEYCRM_TOKEN}`,
          },
          body: JSON.stringify(keycrmPayload),
        });
        const crmData = await crmRes.json().catch(() => ({}));
        if (!crmRes.ok || !crmData?.id) {
          console.error("KeyCRM create order error:", crmData);
        } else {
          order.crmId = crmData.id;
          await order.save();

          // тег партнёра, если нужно
          if (order.isPartner === true) {
            try {
              const tagRes = await fetch(
                `https://openapi.keycrm.app/v1/order/${crmData.id}/tag/1`,
                { method: "POST", headers: { Authorization: `Bearer ${KEYCRM_TOKEN}` } }
              );
              if (!tagRes.ok && tagRes.status !== 409) {
                const t = await tagRes.text().catch(() => "");
                console.error("KeyCRM add tag error:", tagRes.status, t);
              }
            } catch (e) {
              console.error("KeyCRM tag request failed:", e);
            }
          }
        }
      } catch (e) {
        console.error("KeyCRM request failed:", e);
      }
    }

    // 9) Уведомление в Telegram (только для офлайн методов)
    if (OFFLINE_METHODS.includes(payment)) {
      try {
        await sendOrderToTelegram(order.toObject());
      } catch (e) {
        console.error("Telegram send failed:", e);
      }
    }

    // 10) Ответ
    return res.status(201).json({
      message: "Order created",
      order_number: order.order_number,
      data: order,
    });
  } catch (error) {
    console.error("[ERROR] createLocalOrder:", error);
    next(error);
  }
};




export const createLiqpayPayments = async (req, res) => {
  const { totalCost, orderNumber } = req.body;

  try {
    const paymentData = liqpays.cnb_object({
      action: 'pay',
      amount: totalCost,
      currency: 'UAH',
      description: `Оплата замовлення №${orderNumber}`,
      order_id: orderNumber,
      version: '3',
      sandbox: 1, // Удалить на продакшене
    });

    res.json({ paymentLink: `https://www.liqpay.ua/api/3/checkout?data=${paymentData.data}&signature=${paymentData.signature}` });
  } catch (error) {
    console.error("[ERROR] Помилка при створенні платежу LiqPay:", error);
    res.status(500).json({ message: "Помилка сервера." });
  }
}

export const liqPayWebhook = async (req, res, next) => {
  try {
    const { data, signature } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'Missing data in webhook' });
    }

    // 1) Декодируем и парсим
    const decodedData = Buffer.from(data, 'base64').toString('utf8');
    let parsedData;
    try {
      parsedData = JSON.parse(decodedData);
    } catch (err) {
      console.error('[ERROR] JSON parse error:', err);
      return res.status(400).json({ message: 'Invalid JSON in decoded data' });
    }
    console.log('[DEBUG] LiqPay Webhook:', parsedData);

    // 2) Обрабатываем только успешные платежи
    const okStatuses = new Set(['sandbox', 'success']);
    if (!okStatuses.has(String(parsedData.status).toLowerCase())) {
      return res.status(200).json({ message: 'Webhook received', status: parsedData.status });
    }

    // 3) Находим заказ
    const order = await Order.findOne({ order_number: parsedData.order_id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // --- Флаги для идемпотентности ---
    const wasPaid = !!order?.payment?.isPaid;
    let didInventoryChange = false;
    let didOrderChange = false;

    // 4) Списываем со склада ТОЛЬКО один раз (когда заказ ещё не был оплачен) и только для "Новий"
    if (!wasPaid && order.status === 'Новий') {
      try {
        await Promise.all(
          (order.products || []).map(async (p) => {
            const prod = await Product.findById(p._id);
            if (!prod) return;

            const variationArr = prod.variations?.variations || [];
            const vFromOrder = p?.variations?.variations?.[0];

            // матч по variationId, SKU, code
            const variation = variationArr.find((v) =>
              (v._id?.toString && v._id?.toString() === p.variationId?.toString()) ||
              (v.sku && vFromOrder?.sku && v.sku === vFromOrder.sku) ||
              (v.code && vFromOrder?.code && v.code === vFromOrder.code)
            );

            const qty = Number(p.quantity || 0);
            if (variation && qty > 0) {
              variation.quantity = Math.max(0, Number(variation.quantity || 0) - qty);
              await prod.save();
              didInventoryChange = true;
            } else {
              console.warn('[LiqPay webhook] Variation not found or qty=0 for product', prod?._id, p);
            }
          })
        );
      } catch (e) {
        console.error('[Inventory] deduction error:', e);
        // не фейлим вебхук, но логируем
      }
    }

    // 5) Ставим оплату в самом заказе (главное, чего не хватало)
    if (!wasPaid) {
      order.payment = { ...(order.payment || {}), isPaid: true };
      didOrderChange = true;
    }

    // (Опционально) не меняем статус — ты это закомментил
    // if (!wasPaid) order.status = 'Оплачено';

    if (didOrderChange || didInventoryChange) {
      order.updatedAt = new Date();
      await order.save();
      console.log('[LiqPay webhook] Order updated (isPaid set, inventory updated if needed)');
    }

    // 6) Обновляем пользователя: totalSpent/accumulatedDiscount — только при первом успешном платеже
    if (!wasPaid && order.userId) {
      try {
        const user = await User.findById(order.userId);
        if (user) {
          const spent = Number(order.totalCostWithoutDiscount ?? order.totalCost ?? 0);
          user.totalSpent = Number(user.totalSpent || 0) + spent;
          user.accumulatedDiscount = getAccumulatedDiscount(user.totalSpent);
          await user.save();
        }
      } catch (e) {
        console.error('[Webhook] User spend update error', e);
      }
    }

    // 7) Синхронизация с денормализованным массивом user.orders — тоже один раз
    if (!wasPaid) {
      try {
        let matched = 0;

        if (order.userId) {
          const r = await User.updateOne(
            { _id: order.userId, 'orders.order_number': order.order_number },
            { $set: { 'orders.$.payment.isPaid': true, 'orders.$.updatedAt': new Date() } }
          );
          matched = r.matchedCount || r.modifiedCount || 0;
        }

        if (!matched && order?.customer?.phone) {
          await User.updateOne(
            { phone: order.customer.phone, 'orders.order_number': order.order_number },
            { $set: { 'orders.$.payment.isPaid': true, 'orders.$.updatedAt': new Date() } }
          );
        }
      } catch (e) {
        console.error('[UserOrderStatus] update error', e);
      }
    }

    // 8) Достаём человекочитаемые локации (если нужно для TG и CRM)
    const [areaName, cityName, warehouseName] = await Promise.all([
      getAreaName(order.delivery.area),
      getCityName(order.delivery.city),
      getWarehouseName(order.delivery.warehouse),
    ]);

    // 9) Формируем KeyCRM payload (как у тебя)
    const keycrmProducts = order.products.map(item => {
      const qty = item.quantity || 1;
      const unitPrice =
        (item.variations?.variations?.[0]?.price) ??
        item.retailPrice ??
        0;
      return {
        productVariationId: item.id,
        quantity: qty,
        price: unitPrice,
        sku: (item.variations?.variations?.[0]?.sku) || item.sku || '',
        costPrice: item.wholesalePrice || 0,
        discountPercent: item.discount || 0,
        discountAmount: 0,
        isUpsale: false,
        title: item.title?.ru || item.title?.ua || '',
        notes: '',
        warehouseId: 1,
        taxGroup: ''
      };
    });

    const deliveryCommon = {
      serviceType: 'DoorsDoors',
      payerType: 'Sender',
      cargoType: 'Parcel',
      paymentMethod: 'NonCash',
      productPaymentMethod: 'postpaid',
      price: order.totalCost,
      weight: keycrmProducts.reduce((sum, p) => sum + (p.quantity * (p.weight || 0)), 0),
      volumetricVolume: 0,
      seats: [],
      description: order.payment?.comment || ''
    };

    let keycrmDelivery;
    if (order.delivery.type === 'branch') {
      keycrmDelivery = {
        ...deliveryCommon,
        type: 'ukrpost',
        city: cityName,
        cityId: order.delivery.city,
        department: warehouseName,
        departmentId: order.delivery.warehouse
      };
    } else {
      keycrmDelivery = {
        ...deliveryCommon,
        type: 'courier',
        street: order.delivery.address,
        city: cityName,
        cityId: order.delivery.city
      };
    }

    const keycrmPayload = {
      source_id: 3,
      externalId: String(order.order_number),
      products: keycrmProducts,
      buyer_comment: order.payment?.noCall === true ? "Передзвонити: ні" : order.payment?.noCall === false ? "Передзвонити: так" : '',
      discount_amount: order.totalCostWithoutDiscount - order.totalCost,
      shipping: {
        delivery_service_id: order.delivery.type === 'Meest Posht' ? 3 : order.delivery.type === 'Самовивіз' ? '' : 1,
        shipping_service: order.delivery.shipping_service || 'Нова Пошта',
        shipping_address_city: cityName || order.delivery.address || '',
        shipping_address_country: 'Ukraine',
        shipping_address_region: areaName || '',
        shipping_receive_point: (typeof order.delivery.address === 'string' && order.delivery.address.trim()) ? '' : (warehouseName || ''),
        recipient_full_name: `${order.customer.firstname} ${order.customer.lastname}`.trim(),
        recipient_phone: order.customer.phone || ''
      },
      buyer: {
        full_name: `${order.customer.firstname || ''} ${order.customer.lastname || ''}`.trim(),
        phone: order.customer.phone || ''
      },
      payments: [
        {
          payment_method_id: 1,
          payment_method: order.payment?.method === 'cash' ? 'Готівка' : 'Карта',
          amount: order.totalCost,
          description: 'Оплата картою',
          payment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          status: 'paid'
        }
      ],
      attachments: [],
      utm: {}
    };

    try {
      const crmResponse = await fetch(KEYCRM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEYCRM_TOKEN}`
        },
        body: JSON.stringify(keycrmPayload)
      });
      const crmData = await crmResponse.json().catch(() => ({}));
      if (!crmResponse.ok || !crmData?.id) {
        console.error('KeyCRM error (create order):', crmData);
      } else {
        // Вешаем тег партнёра при необходимости
        if (order.isPartner === true || order.isPartner === "true") {
          const KEYCRM_TAG_ID = 1; // <-- замени на свой ID тега
          try {
            const tagRes = await fetch(`https://openapi.keycrm.app/v1/order/${crmData.id}/tag/${KEYCRM_TAG_ID}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KEYCRM_TOKEN}` }
            });
            const tagBody = await tagRes.text().catch(() => '');
            if (!tagRes.ok && tagRes.status !== 409) {
              console.error('KeyCRM add tag error:', tagRes.status, tagBody);
            }
          } catch (e) {
            console.error('KeyCRM tag request failed:', e);
          }
        }
      }
    } catch (e) {
      console.error('KeyCRM request failed:', e);
    }

    // 10) Telegram
    try {
      const { method = 'card', promo = '', comment = '', acceptPolicy = false, noCall = false } = order.payment || {};
      const telegramProducts = order.products.map(p => {
        const qty = p.quantity || 1;
        const total = p.discountedTotal != null ? p.discountedTotal : p.total;
        return { id: p.id, title: p.title, quantity: qty, unitPrice: total / qty, total };
      });
      const telegramData = {
        order_number: order.order_number,
        totalCost: order.totalCost,
        products: telegramProducts,
        customer: order.customer,
        delivery: { ...order.delivery, areaName, cityName, warehouseName },
        payment: { method, promo, comment, acceptPolicy, noCall, isPaid: true },
        status: order.status
      };
      await sendOrderToTelegram(telegramData);
    } catch (e) {
      console.error('Telegram send failed:', e);
    }

    return res.status(200).json({ message: 'Webhook processed', isPaid: true });
  } catch (error) {
    console.error('[ERROR] liqPayWebhook:', error);
    next(error);
  }
};






//   const handleLiqPayPayment = async (totalCost, orderNumber) => {
//     try {
//         const response = await fetch("http://51.21.2.136/api/payments/liqpay", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ totalCost, orderNumber }),
//         });

//         const result = await response.json();
//         if (!response.ok) {
//             console.error("Помилка оплати LiqPay:", result.message);
//             return false;
//         }

//         window.location.href = result.paymentLink; // Перенаправить пользователя на страницу оплаты
//         return true;
//     } catch (error) {
//         console.error("Помилка при створенні платежу LiqPay:", error);
//         return false;
//     }
// };

// const handleSubmit = async (e) => {
//     e.preventDefault();

//     const errors = validateFields(orderDetails);
//     setValidationErrors(errors);
//     if (Object.keys(errors).length > 0) return;

//     const paymentConfirmed = await handleLiqPayPayment(orderDetails.totalCost, orderDetails.order_number);
//     if (!paymentConfirmed) {
//         setModal({
//             isOpen: true,
//             title: "Помилка!",
//             message: "Оплата не вдалася. Спробуйте ще раз.",
//         });
//         return;
//     }

//     // После успешной оплаты продолжить отправку данных заказа
//     try {
//         const response = await fetch("http://51.21.2.136/api/orders/register-order", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(orderDetails),
//         });

//         const result = await response.json();

//         if (response.ok) {
//             setModal({
//                 isOpen: true,
//                 title: "Успіх!",
//                 message: "Замовлення успішно оформлено!",
//             });
//             localStorage.removeItem("discount");
//         } else {
//             setModal({
//                 isOpen: true,
//                 title: "Помилка!",
//                 message: result.message || "Сталася помилка під час оформлення замовлення.",
//             });
//         }
//     } catch (error) {
//         console.error("Error:", error);
//         setModal({
//             isOpen: true,
//             title: "Помилка!",
//             message: "Сталася помилка під час оформлення замовлення.",
//         });
//     }

// };