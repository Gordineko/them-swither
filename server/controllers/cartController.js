
import Settings from "../models/admin/Settings.js";
import { User } from "../models/User.js";
import { calculateTotals } from "../utils/cartTotals.js";

/**
 * Генерирует уникальный ключ вариации:
 * - если есть variation.sku — берём его;
 * - иначе сериализуем объект вариации в строку.
 */
function getSelectedVariationKey(variation) {
  if (!variation || typeof variation !== 'object') return null;

  if (variation.sku) {
    return variation.sku;
  }
  // убираем неопределённые и пустые поля, чтобы строка была короче
  const filtered = Object.entries(variation)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return filtered.map(([k, v]) => `${k}=${v}`).join(';');
}

function isSameVariation(key1, key2) {
  return key1 === key2;
}

// export const addToCart = async (req, res) => {
//   try {
//     const { productId, userId, quantity = 1, product } = req.body;

//     // выбранная вариация из фронта
//     const variation = product.selectedVariation;
//     const selectedVariationKey = getSelectedVariationKey(variation);

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

//     // убираем "пустышки"
//     user.cart = user.cart.filter(item => item.productId);

//     // ищем совпадение по productId + variationKey
//     const existing = user.cart.find(item =>
//       item.productId.toString() === productId &&
//       isSameVariation(item.variation, selectedVariationKey)
//     );

//     if (existing) {
//       existing.quantity += quantity;
//     } else {
//       user.cart.push({
//         productId:         product._id,
//         id:                product.id,
//         code:              product.code,
//         sku:               product.sku,
//         title:             product.title,
//         titleLink:         product.titleLink,
//         category:          product.category,
//         categoryLink:      product.categoryLink,
//         subcategory:       product.subcategory,
//         subcategoryLink:   product.subcategoryLink,
//         country:           product.country,
//         unit:              product.unit,
//         cost:              product.retailPrice,
//         opt_cost_uah:          product.wholesalePrice,
//         discount:          product.discount || 0,
//         description:       product.description,
//         imageURL:          product.imageURL,
//         multiplicity:      product.multiplicity,
//         components:        product.components,
//         characteristics:   product.characteristics,
//         variations:        product.variations,
//         variation:         selectedVariationKey,
//         selectedVariation: variation || null,
//         quantity,
//         weightQuantity:    product.weight
//       });
//     }

//     await user.save();

//     // пересчитываем корзину
//     const updatedUser = await User.findById(userId).populate('cart.productId');
//     const updatedCart = updatedUser.cart.map(item => {
//       if (!item.productId) return item;
//       const doc = item.productId;
//       let basePrice = doc.retailPrice || 0;
//       if (item.selectedVariation && item.selectedVariation.price != null) {
//         basePrice = item.selectedVariation.price;
//       }
//       const discount = doc.discount || 0;
//       return { 
//         ...item.toObject(), 
//         finalPrice: basePrice * (1 - discount / 100) 
//       };
//     });

//     const totalPrice = updatedCart.reduce(
//       (sum, it) => sum + (it.finalPrice || 0) * it.quantity, 
//       0
//     );
//     const totalQuantity = updatedCart.reduce(
//       (sum, it) => sum + it.quantity, 
//       0
//     );

//     return res.status(200).json({
//       message:       'Корзина обновлена',
//       cart:          updatedCart,
//       totalPrice,
//       totalQuantity
//     });

//   } catch (error) {
//     console.error('Ошибка при обновлении корзины:', error);
//     return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
//   }
// };

export const addToCart = async (req, res) => {
  try {
    const { productId, userId, quantity = 1 } = req.body;

    const user = await User.findById(userId).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const setting = await Settings.findOne({ key: 'exchangeRate' });
    const rate = setting?.value || 1;

    const isPartner = user.isPartner === true;
    // const userDiscount = user.accumulatedDiscount || 0;
    const totalSpent = user.totalSpent



    user.cart = user.cart.filter(item => item.productId);
    const existing = user.cart.find(item =>
      item.productId._id?.toString() === productId || item.productId?.toString() === productId
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cart.push({ productId, quantity });
    }
    await user.save();

    const populated = await User.findById(userId).populate('cart.productId');
    const cartEntries = populated.cart.map(({ productId: prod, quantity }) => {
      let unitPriceUAH;
      if (isPartner) {
        unitPriceUAH = prod.variations?.variations?.[0]?.opt_price_uah
          ?? prod.opt_cost_uah
          ?? 0;
      } else {
        // Вот исправленная часть:
        const variation = prod.variations?.variations?.[0];
        if (variation && typeof variation.price === 'number') {
          unitPriceUAH = variation.price * (1 - (prod.discount || 0) / 100);
        } else {
          unitPriceUAH = prod.retailPrice * (1 - (prod.discount || 0) / 100);
        }
        unitPriceUAH = +unitPriceUAH.toFixed(2);
      }
      return { prod, quantity, unitPrice: unitPriceUAH };
    });

    const totalQuantity = cartEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalBefore = cartEntries.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);

    let userDiscount
    if (totalBefore + totalSpent >= 45000) {
      userDiscount = 10;
    } else if (totalBefore + totalSpent >= 30000) {
      userDiscount = 7;
    } else if (totalBefore + totalSpent >= 20000) {
      userDiscount = 5;
    } else if (totalBefore + totalSpent >= 4500) {
      userDiscount = 2
    } else {
      userDiscount = 0
    }

    const partnerThresholdUAH = 200 * rate;
    let discountFactor = 1;
    if (isPartner && totalBefore >= partnerThresholdUAH) {
      discountFactor = 0.95;
    } else if (!isPartner && userDiscount > 0) {
      discountFactor = 1 - userDiscount / 100;
    }

    const totalPrice = +(totalBefore * discountFactor).toFixed(2);

    const cart = cartEntries.map(({ prod, quantity, unitPrice }) => ({
      ...prod.toObject(),
      quantity,
      lineTotal: +(unitPrice * quantity * discountFactor).toFixed(2)
    }));

    return res.status(200).json({
      message: 'Корзина обновлена',
      cart,
      totalQuantity,
      totalPrice,
      originalTotalPrice: +totalBefore.toFixed(2)
    });

  } catch (error) {
    console.error('Ошибка при добавлении в корзину:', error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};


export const removeFromCart = async (req, res) => {
  try {
    const { productId, userId } = req.body;

    // 1) Загружаем пользователя и курс
    const user = await User.findById(userId).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const setting = await Settings.findOne({ key: 'exchangeRate' });
    const rate = setting?.value || 1;

    const isPartner = user.isPartner === true;
    // const userDiscount = user.accumulatedDiscount || 0;
    const totalSpent = user.totalSpent

    // 2) Удаляем товар из корзины
    user.cart = user.cart.filter(item =>
      item.productId._id.toString() !== productId
    );
    await user.save();

    // 3) Собираем позиции и считаем цены в UAH
    const populated = await User.findById(userId).populate('cart.productId');
    const cartEntries = populated.cart.map(({ productId: prod, quantity }) => {
      let unitPriceUAH;
      if (isPartner) {
        unitPriceUAH = prod.variations?.variations?.[0]?.opt_price_uah
          ?? prod.opt_cost_uah
          ?? 0;
      } else {
        const variation = prod.variations?.variations?.[0];
        if (variation && typeof variation.price === 'number') {
          unitPriceUAH = variation.price * (1 - (prod.discount || 0) / 100);
        } else {
          unitPriceUAH = prod.retailPrice * (1 - (prod.discount || 0) / 100);
        }
        unitPriceUAH = +unitPriceUAH.toFixed(2);
      }
      return { prod, quantity, unitPrice: unitPriceUAH };
    });

    // 4) Итоги до скидки
    const totalQuantity = cartEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalBefore = cartEntries.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
    let userDiscount
    if (totalBefore + totalSpent >= 45000) {
      userDiscount = 10;
    } else if (totalBefore + totalSpent >= 30000) {
      userDiscount = 7;
    } else if (totalBefore + totalSpent >= 20000) {
      userDiscount = 5;
    } else if (totalBefore + totalSpent >= 4500) {
      userDiscount = 2
    } else {
      userDiscount = 0
    }
    // 5) Порог партнёрской скидки
    const partnerThresholdUAH = 200 * rate;
    let discountFactor = 1;
    if (isPartner && totalBefore >= partnerThresholdUAH) {
      discountFactor = 0.95;
    } else if (!isPartner && userDiscount > 0) {
      discountFactor = 1 - userDiscount / 100;
    }

    const totalPrice = +(totalBefore * discountFactor).toFixed(2);

    // 6) Финальный массив для фронта
    const cart = cartEntries.map(({ prod, quantity, unitPrice }) => ({
      ...prod.toObject(),
      quantity,
      lineTotal: +(unitPrice * quantity * discountFactor).toFixed(2)
    }));

    return res.status(200).json({
      message: 'Корзина обновлена после удаления',
      cart,
      totalQuantity,
      totalPrice,
      originalTotalPrice: +totalBefore.toFixed(2)
    });

  } catch (error) {
    console.error('Ошибка при удалении товара из корзины:', error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};


export const getCart = async (req, res) => {
  try {
    const { userId } = req.query;

    // 1) Получаем пользователя и курс
    const user = await User.findById(userId).populate('cart.productId');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    const setting = await Settings.findOne({ key: 'exchangeRate' });
    const rate = setting?.value || 1;  // курс UAH за 1 USD

    const isPartner = user.isPartner === true;
    // const userDiscount = user.accumulatedDiscount || 0;
    const totalSpent = user.totalSpent

    // 2) Собираем позиции корзины с пересчётом в UAH
    const cartEntries = user.cart.map(({ productId: prod, quantity }) => {
      let unitPriceUAH;
      if (isPartner) {
        unitPriceUAH = prod.variations?.variations?.[0]?.opt_price_uah
          ?? prod.opt_cost_uah
          ?? 0;
      } else {
        const variation = prod.variations?.variations?.[0];
        if (variation && typeof variation.price === 'number') {
          unitPriceUAH = variation.price * (1 - (prod.discount || 0) / 100);
        } else {
          unitPriceUAH = prod.retailPrice * (1 - (prod.discount || 0) / 100);
        }
        unitPriceUAH = +unitPriceUAH.toFixed(2);
      }
      return { prod, quantity, unitPrice: unitPriceUAH };
    });

    // 3) Считаем общее количество и суммарную цену до скидки
    const totalQuantity = cartEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalBefore = cartEntries.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
    let userDiscount
    if (totalBefore + totalSpent >= 45000) {
      userDiscount = 10;
    } else if (totalBefore + totalSpent >= 30000) {
      userDiscount = 7;
    } else if (totalBefore + totalSpent >= 20000) {
      userDiscount = 5;
    } else if (totalBefore + totalSpent >= 4500) {
      userDiscount = 2
    } else {
      userDiscount = 0
    }
    // 4) Применяем скидку
    // Порог для партнёров: 200 USD → в гривне 200 * rate
    const partnerThresholdUAH = 200 * rate;
    let discountFactor = 1;

    if (isPartner && totalBefore >= partnerThresholdUAH) {
      discountFactor = 0.95;
    } else if (!isPartner && userDiscount > 0) {
      discountFactor = 1 - userDiscount / 100;
    }

    const totalPrice = +(totalBefore * discountFactor).toFixed(2);

    // 5) Формируем финальный массив
    const cart = cartEntries.map(({ prod, quantity, unitPrice }) => ({
      ...prod.toObject(),
      quantity,
      lineTotal: +(unitPrice * quantity * discountFactor).toFixed(2)
    }));

    return res.status(200).json({
      message: 'Корзина успешно получена',
      cart,
      totalQuantity,
      totalPrice,
      originalTotalPrice: +totalBefore.toFixed(2)
    });
  } catch (error) {
    console.error('Ошибка при получении корзины:', error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};


export const updateCartItemQuantity = async (req, res) => {
  try {
    const { productId, userId, quantity } = req.body;

    // Получаем пользователя и курс
    const user = await User.findById(userId).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const setting = await Settings.findOne({ key: 'exchangeRate' });
    const rate = setting?.value || 1;  // курс UAH за 1 USD

    const isPartner = user.isPartner === true;
    // const userDiscount = user.accumulatedDiscount || 0;
    const totalSpent = user.totalSpent

    // Обновляем количество в корзине
    const item = user.cart.find(i => i.productId._id.toString() === productId);
    if (!item) return res.status(404).json({ message: 'Элемент корзины не найден' });

    item.quantity = quantity;
    await user.save();

    // Собираем данные корзины
    const populated = await User.findById(userId).populate('cart.productId');
    const cartEntries = populated.cart.map(({ productId: prod, quantity }) => {
      let unitPriceUAH;

      if (isPartner) {
        // для партнёров — берём оптовую цену уже в UAH
        unitPriceUAH = prod.variations?.variations?.[0]?.opt_price_uah
          ?? prod.opt_cost_uah
          ?? 0;
      } else {
        // для обычных — берём цену вариации в UAH, если есть
        const variation = prod.variations?.variations?.[0];
        if (variation && typeof variation.price === 'number') {
          unitPriceUAH = variation.price;
        } else {
          // иначе fallback на retailPrice (UAH) с учётом скидки
          unitPriceUAH = +(prod.retailPrice * (1 - (prod.discount || 0) / 100)).toFixed(2);
        }
      }

      // Применяем партнёрскую/накопительную скидку по строке
      return { prod, quantity, unitPrice: unitPriceUAH };
    });

    const totalQuantity = cartEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalBefore = cartEntries.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);

    let userDiscount
    if (totalBefore + totalSpent >= 45000) {
      userDiscount = 10;
    } else if (totalBefore + totalSpent >= 30000) {
      userDiscount = 7;
    } else if (totalBefore + totalSpent >= 20000) {
      userDiscount = 5;
    } else if (totalBefore + totalSpent >= 4500) {
      userDiscount = 2
    } else {
      userDiscount = 0
    }
    // Граница партнёрской скидки: 200 USD → умножаем на курс
    const partnerThresholdUAH = 200 * rate;
    let discountFactor = 1;
    if (isPartner && totalBefore >= partnerThresholdUAH) {
      discountFactor = 0.95;
    } else if (!isPartner && userDiscount > 0) {
      discountFactor = 1 - userDiscount / 100;
    }

    const totalPrice = +(totalBefore * discountFactor).toFixed(2);

    const cart = cartEntries.map(({ prod, quantity, unitPrice }) => ({
      ...prod.toObject(),
      quantity,
      lineTotal: +(unitPrice * quantity * discountFactor).toFixed(2)
    }));

    console.log(totalBefore + totalSpent, totalPrice)

    return res.status(200).json({
      message: 'Количество товара обновлено',
      cart,
      totalQuantity,
      totalPrice,
      originalTotalPrice: +totalBefore.toFixed(2)
    });

  } catch (error) {
    console.error('Ошибка обновления количества товара в корзине:', error);
    return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};






export const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;
    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    // Очищаем корзину
    user.cart = [];
    await user.save();

    return res.status(200).json({
      message: "Корзина успешно очищена",
      cart: user.cart,
    });
  } catch (error) {
    console.error("Ошибка при очистке корзины:", error.message);
    return res
      .status(500)
      .json({ message: "Ошибка сервера", error: error.message });
  }
};

