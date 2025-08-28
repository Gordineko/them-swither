import { User } from "../models/User.js";

export const addToCompare = async (req, res) => {
  try {
    const { productId, userId } = req.body;
    console.log(req.body);
    // Находим пользователя
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Проверяем, нет ли уже товара в вишлисте
    if (user.compare.includes(productId)) {
      return res.status(400).json({ message: "Товар уже в compare" });
    }

    // Добавляем товар в вишлист
    user.compare.push(productId);
    await user.save();

    // Заполняем (populate) вишлист объектами товаров
    user = await user.populate("compare");

    return res.status(200).json({
      message: "Товар успешно добавлен в compare",
      compare: user.compare,
    });
  } catch (error) {
    console.error("Ошибка при добавлении товара в compare:", error.message);
    return res
      .status(500)
      .json({ message: "Ошибка сервера", error: error.message });
  }
};

export const removeFromCompare = async (req, res) => {
  try {
    const { productId, userId } = req.body;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Фильтруем вишлист, удаляя указанный товар
    user.compare = user.compare.filter(
      (item) => item.toString() !== productId
    );
    await user.save();

    // Заполняем (populate) вишлист объектами товаров
    user = await user.populate("compare");

    return res.status(200).json({
      message: "Товар успешно удалён из compare",
      compare: user.compare,
    });
  } catch (error) {
    console.error("Ошибка при удалении товара из compare:", error.message);
    return res
      .status(500)
      .json({ message: "Ошибка сервера", error: error.message });
  }
};

export const getCompare = async (req, res) => {
  try {
    const { userId } = req.query;
    //   const userId = req.user._id; // Предполагается, что пользователь аутентифицирован

    // Находим пользователя и популяция поля wishlist, чтобы получить данные о товарах
    const user = await User.findById(userId).populate("compare");
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    console.debug("compare пользователя:", user.compare);
    return res.status(200).json({
      message: "compare успешно получен",
      compare: user.compare,
    });
  } catch (error) {
    console.error("Ошибка при получении compare:", error.message);
    return res.status(500).json({
      message: "Ошибка сервера",
      error: error.message,
    });
  }
};

// controllers/cartController.js

// controllers/compareController.js

export const removeFromCompareByCategory = async (req, res) => {
  try {
    const { profileId, categoryLink } = req.body;

    if (!profileId || !categoryLink) {
      return res.status(400).json({ message: "profileId и categoryLink обязательны" });
    }

    const user = await User.findById(profileId).populate("compare");

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Фильтруем compare по categoryLink
    user.compare = user.compare.filter((product) => {
      return product.categoryLink !== categoryLink;
    });

    await user.save();

    return res.status(200).json({
      message: "Товары удалены из сравнения по категории",
      compare: user.compare,
    });
  } catch (error) {
    console.error("❌ Ошибка удаления из сравнения:", error);
    return res.status(500).json({ message: "Ошибка сервера", error: error.message });
  }
};

export const clearCompare = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    user.compare = [];
    await user.save();

    return res.status(200).json({
      message: "Сравнение очищено",
      compare: user.compare,
    });
  } catch (error) {
    console.error("Ошибка при очистке сравнения:", error.message);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
};
