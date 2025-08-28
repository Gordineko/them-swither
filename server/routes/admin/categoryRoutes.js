import express from "express";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../controllers/admin/categoryController.js";
import Category from "../../models/Category.js";

const router = express.Router();

// 1) Настраиваем папку для загрузки и раздачу статики
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
router.use('/uploads', express.static(uploadDir));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 2) Конфигурируем Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // .png, .jpg и т.п.
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '-')              // заменяем пробелы
      .replace(/[^a-zA-Z0-9-_]/g, '');   // удаляем лишнее
    const uniqueName = `${Date.now()}-${base}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024,
    fields: 50,
  }
});

router.put('/:id/move', async (req, res) => {
  const { direction } = req.body;
  const { id } = req.params;
  const current = await Category.findById(id);
  if (!current) return res.status(404).json({ message: "Категорія не знайдена" });

  // Найти категорию для обмена порядком
  const orderQuery = direction === "up"
    ? { order: { $lt: current.order } }
    : { order: { $gt: current.order } };
  const sortDir = direction === "up" ? -1 : 1;
  const swapWith = await Category.findOne(orderQuery).sort({ order: sortDir });

  if (!swapWith) return res.status(400).json({ message: "Некуда двигать" });

  // Обмен order
  const temp = current.order;
  current.order = swapWith.order;
  swapWith.order = temp;

  await current.save();
  await swapWith.save();

  res.json({ message: "Порядок обновлен" });
});

router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ message: "Invalid ids" });

  const bulk = ids.map((_id, i) => ({
    updateOne: {
      filter: { _id },
      update: { order: i + 1 }
    }
  }));
  await Category.bulkWrite(bulk);

  // После обновления — получаем список с новым порядком!
  const categories = await Category.find({}).sort({ order: 1 });

  // Возвращаем массив категорий!
  res.json(categories);
});


// Маршруты
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Создать новую категорию с одним изображением
router.post(
  "/",
  upload.any(),
  async (req, res, next) => {
    try {
      // Ищем в req.files основной файл с fieldname 'image'
      if (Array.isArray(req.files)) {
        const mainFile = req.files.find(f => f.fieldname === "image");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        if (mainFile) {
          req.body.imageURL = `${baseUrl}/uploads/${encodeURIComponent(mainFile.filename)}`;
        }
      }

      const newCategory = await createCategory(req, res);
      res.status(201).json(newCategory);
    } catch (error) {
      next(error);
    }
  }
);


// Обновить категорию, принимать любое количество изображений
router.put("/:id", upload.any(), async (req, res, next) => {
  try {
    console.log("Received files for update:", req.files);
    console.log("Request body:", req.body);

    // 1. Парсим подкатегории, если они пришли строкой
    if (typeof req.body.subcategories === "string") {
      try {
        req.body.subcategories = JSON.parse(req.body.subcategories);
      } catch (e) {
        return res.status(400).json({ message: "Невалидный JSON в поле subcategories" });
      }
    }

    // 2. Основное изображение категории
    const mainFile = req.files.find(f => f.fieldname === "image");
    if (mainFile) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      req.body.imageURL = `${baseUrl}/uploads/${encodeURIComponent(mainFile.filename)}`;
    }

    // 3. Изображения подкатегорий
    if (Array.isArray(req.body.subcategories)) {
      req.body.subcategories.forEach((sub, idx) => {
        const subFile = req.files.find(f => f.fieldname === `subcategories[${idx}][image]`);
        if (subFile) {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          sub.imageURL = `${baseUrl}/uploads/${encodeURIComponent(subFile.filename)}`;
        }
      });
    }

    // 4. Передаём в обработчик
    await updateCategory(req, res);
  } catch (error) {
    next(error);
  }
});



router.delete("/:id", deleteCategory);
router.put("/:id/toggle-visibility", async (req, res) => {
  try {
    const { isVisible } = req.body;
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { isVisible },
      { new: true }
    );
    if (!updatedCategory) return res.status(404).json({ message: "Категорию не найдено" });
    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
