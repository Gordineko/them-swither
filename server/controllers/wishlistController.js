
import { User } from "../models/User.js";

export const addToWishlist = async (req, res) => {
  try {
    const { productId, userId } = req.body;
    console.log(req.body);
    // Находим пользователя
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Проверяем, нет ли уже товара в вишлисте
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: "Товар уже в вишлисте" });
    }

    // Добавляем товар в вишлист
    user.wishlist.push(productId);
    await user.save();

    // Заполняем (populate) вишлист объектами товаров
    user = await user.populate("wishlist");

    return res.status(200).json({
      message: "Товар успешно добавлен в вишлист",
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error("Ошибка при добавлении товара в вишлист:", error.message);
    return res
      .status(500)
      .json({ message: "Ошибка сервера", error: error.message });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const { productId, userId } = req.body;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Фильтруем вишлист, удаляя указанный товар
    user.wishlist = user.wishlist.filter(
      (item) => item.toString() !== productId
    );
    await user.save();

    // Заполняем (populate) вишлист объектами товаров
    user = await user.populate("wishlist");

    return res.status(200).json({
      message: "Товар успешно удалён из вишлиста",
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error("Ошибка при удалении товара из вишлиста:", error.message);
    return res
      .status(500)
      .json({ message: "Ошибка сервера", error: error.message });
  }
};


export const getWishlist = async (req, res) => {
  try {
    const { userId } = req.query;
    //   const userId = req.user._id; // Предполагается, что пользователь аутентифицирован

    // Находим пользователя и популяция поля wishlist, чтобы получить данные о товарах
    const user = await User.findById(userId).populate("wishlist");
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    console.debug("Вишлист пользователя:", user.wishlist);
    return res.status(200).json({
      message: "Вишлист успешно получен",
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error("Ошибка при получении вишлиста:", error.message);
    return res.status(500).json({
      message: "Ошибка сервера",
      error: error.message,
    });
  }
};
