import { User } from '../../models/User.js'; // Импортируйте вашу модель пользователя

// 1. Получение всех промокодов пользователя
export const getPromoCodes = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('promoCodes');
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }
        return res.status(200).json({ promoCodes: user.promoCodes });
    } catch (error) {
        console.error("Ошибка при получении промокодов:", error.message);
        return res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
};

// 2. Добавление нового промокода
export const addPromoCode = async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, discount, validUntil, quantity } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        // Проверяем, нет ли уже такого промокода
        const existingPromo = user.promoCodes.find(promo => promo.title === title);
        if (existingPromo) {
            return res.status(400).json({ message: "Промокод уже добавлен" });
        }

        // Добавляем промокод
        user.promoCodes.push({ title, discount, validUntil, quantity });
        await user.save();

        return res.status(200).json({ message: "Промокод успешно добавлен", promoCodes: user.promoCodes });
    } catch (error) {
        console.error("Ошибка при добавлении промокода:", error.message);
        return res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
};

// 3. Обновление промокода (например, изменение скидки, срока действия или количества)
export const updatePromoCode = async (req, res) => {
    try {
        const { userId, promoCodeId } = req.params;
        const { discount, validUntil, quantity } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        // Ищем промокод по его _id
        const promo = user.promoCodes.id(promoCodeId);
        if (!promo) {
            return res.status(404).json({ message: "Промокод не найден" });
        }

        // Обновляем поля, если они переданы в теле запроса
        if (discount !== undefined) promo.discount = discount;
        if (validUntil !== undefined) promo.validUntil = validUntil;
        if (quantity !== undefined) promo.quantity = quantity;

        await user.save();

        return res.status(200).json({ message: "Промокод обновлён", promoCode: promo });
    } catch (error) {
        console.error("Ошибка при обновлении промокода:", error.message);
        return res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
};

// 4. Удаление промокода
export const removePromoCode = async (req, res) => {
    try {
      const { userId, promoCodeId } = req.params;
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
  
      user.promoCodes = user.promoCodes.filter(
        promo => promo._id.toString() !== promoCodeId
      );
      await user.save();
  
      return res.status(200).json({ message: "Промокод удалён", promoCodes: user.promoCodes });
    } catch (error) {
      console.error("Ошибка при удалении промокода:", error.message);
      return res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
  };
  