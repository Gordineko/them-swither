// src/routes/admin/products.js

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductGroup,
  updateProductGroup,
  getProductGroups,
  deleteProductGroup,
  getProductGroupById,
  searchProducts,
  getProductsByIds
} from "../../controllers/admin/productController.js";
import Product from "../../models/Product.js";

const router = express.Router();

// 1) Раздаём статику: все файлы из public/uploads доступны по /uploads/имя
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
router.use('/uploads', express.static(uploadDir));


// 2) Убеждаемся, что папка существует
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 3) Настраиваем Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // до 10 МБ на текстовое поле
    fields: 50,                  // до 50 полей всего
  },
});



router.get("/search", searchProducts);
router.get("/by-ids", getProductsByIds);
// 4) Группы продуктов
router.get("/groups", getProductGroups);
router.get("/groups/:groupId", getProductGroupById);
router.post(
  "/group",
  upload.any(),                  // принимаем динамические поля files и variations[N][img]
  createProductGroup
);
router.put(
  "/group/:id",
  upload.any(),                  // принимаем любые файлы для обновления группы
  updateProductGroup
);
router.delete("/groups/:groupId", deleteProductGroup);

// 5) Массовое обновление видимости
router.put("/mass-visibility", async (req, res) => {
  try {
    const { ids, isVisible } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: "Поле ids должно быть массивом" });
    }
    const result = await Product.updateMany(
      { id: { $in: ids } },
      { isVisible }
    );
    res.json({ message: "Видимость обновлена", result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6) CRUD: список и получение
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// 7) Создание товара с загрузкой изображений
router.post(
  "/",
  upload.any(),                  // любые файлы (например, images)
  async (req, res, next) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const imageURLs = (req.files || []).map(
        (f) => `${baseUrl}/uploads/${encodeURIComponent(f.filename)}`
      );

      req.body.imageURL = imageURLs;
      const newProduct = await createProduct(req, res);
      res.status(201).json(newProduct);
    } catch (err) {
      next(err);
    }
  }
);

// 8) Обновление товара с загрузкой новых изображений
router.put(
  "/:id",
  upload.any(),                  // любые файлы
  async (req, res, next) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // Старые изображения
      let existingImages = [];
      if (req.body.existingImages) {
        if (typeof req.body.existingImages === "string") {
          try { existingImages = JSON.parse(req.body.existingImages); }
          catch { existingImages = []; }
        } else if (Array.isArray(req.body.existingImages)) {
          existingImages = req.body.existingImages;
        }
      }

      // Новые файлы
      const newImages = (req.files || []).map(
        (file) => `${baseUrl}/uploads/${encodeURIComponent(file.filename)}`
      );

      req.body.imageURL = [...existingImages, ...newImages];

      await updateProduct(req, res);
    } catch (err) {
      next(err);
    }
  }
);

// 9) Удаление товара
router.delete("/:id", deleteProduct);

// 10) Обновление видимости одного товара
router.put(
  "/:id/visibility",
  async (req, res) => {
    try {
      const { isVisible } = req.body;
      const prod = await Product.findOneAndUpdate(
        { id: req.params.id },
        { isVisible },
        { new: true }
      );
      if (!prod) return res.status(404).json({ message: "Product not found" });
      res.json(prod);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// 11) Отдельная загрузка файлов (товары и вариации)
router.post(
  "/upload",
  upload.any(), // принимаем любые файлы
  async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const uploaded = (req.files || []).map((f) => ({
        img_link: `${baseUrl}/uploads/${encodeURIComponent(f.filename)}`,
        type: f.mimetype.startsWith("video/") ? "video" : "image",
      }));

      // --- 1. Вставка картинок в описание (через Tiptap) ---
      // Если groupId не передан, просто вернуть массив ссылок
      if (!req.body.groupId) {
        return res.status(200).json(uploaded);
      }

      // --- 2. Загрузка для карточки продукта или вариации ---
      const groupId = parseInt(req.body.groupId, 10);
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid or missing groupId" });
      }
      const uploadTarget    = req.body.uploadTarget;
      const variationIndex  = Number(req.body.variationIndex);
      const variantKeyUa    = req.body.variantKeyUa;

      // 2.1) Групповые изображения
      if (uploadTarget === "product") {
        await Product.updateMany(
          { groupId },
          { $push: { imageURL: { $each: uploaded.map(u => u.img_link) } } }
        );
      }
      // 2.2) Изображения вариаций (ищет по названию опции на укр)
      else if (uploadTarget === "variation") {
        if (!variantKeyUa) {
          return res.status(400).json({ message: "Для variation нужен variantKeyUa" });
        }
        await Product.updateOne(
          { groupId, "variations.variations.option.ua": variantKeyUa },
          { $push: { "variations.variations.$.img": { $each: uploaded } } }
        );
      }

      // Возвращаем массив файлов всегда
      res.status(200).json(uploaded);
    } catch (err) {
      console.error("[upload error]", err);
      res.status(500).json({ message: "Ошибка загрузки/обновления" });
    }
  }
);


export default router;
