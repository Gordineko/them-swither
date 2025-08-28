import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import PriceFile from "../models/PriceFile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Храним вне public, а раздаём через express.static('/uploads')
const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "public",
  "uploads"
);

// Директория под файлы
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Публичный URL (filename мы будем percent-encode'ить)
function buildPublicUrl(savedFileName) {
  return `http:// 192.168.0.106:5002/uploads/${encodeURIComponent(
    savedFileName
  )}`;
}

// GET /admin/api/prices
export async function listPrices(req, res) {
  try {
    const list = await PriceFile.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.json(list);
  } catch (e) {
    console.error("[Prices] GET error:", e);
    return res.status(500).json({
      message: "Помилка отримання списку прайсів",
    });
  }
}

// POST /admin/api/prices/upload
export async function uploadPrice(req, res) {
  try {
    const file = req.file;
    if (!file)
      return res
        .status(400)
        .json({ message: "Файл не передано" });

    const url = buildPublicUrl(file.filename);

    // В базу кладём «читаемое» имя отдельно: берем именно «лучшее»
    // Чтобы здесь не дублировать логику, возьмём оригинал Multer'а как есть,
    // а для фронта будете показывать либо originalNameDecoded, либо fileName.
    const originalNameDecoded = file.originalname; // уже «починенный» мы делали в storage.filename

    const doc = await PriceFile.create({
      originalName: originalNameDecoded,
      fileName: file.filename, // фактическое имя на диске
      url, // публичная ссылка
      size: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user?._id || null,
    });

    return res.json({ ok: true, file: doc });
  } catch (e) {
    console.error("[Prices] UPLOAD error:", e);
    return res.status(500).json({
      message:
        e.message || "Помилка завантаження",
    });
  }
}

// DELETE /admin/api/prices/:id
export async function deletePrice(req, res) {
  try {
    const doc = await PriceFile.findById(
      req.params.id
    );
    if (!doc)
      return res
        .status(404)
        .json({ message: "Файл не знайдено" });

    const filePath = path.join(
      UPLOAD_DIR,
      doc.fileName
    );
    try {
      if (fs.existsSync(filePath))
        fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("[Prices] FS unlink warn:", e);
    }

    await doc.deleteOne();
    return res.json({ ok: true });
  } catch (e) {
    console.error("[Prices] DELETE error:", e);
    return res
      .status(500)
      .json({ message: "Помилка видалення" });
  }
}

export { UPLOAD_DIR };
