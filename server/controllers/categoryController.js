
import Category from "../models/Category.js";

export const getCategories = async (req, res) => {
  try {
    const foundCategories = await Category.find({ isVisible: { $ne: false } })
      .sort({ order: 1 });  // <--- сортировка по order по возрастанию

    if (!foundCategories || foundCategories.length === 0) {
      return res.status(404).json({ message: "Категорії не знайдено" });
    }

    res.json(foundCategories);
  } catch (error) {
    res.status(500).json({ message: "Помилка отримання даних", error });
  }
};


