import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { listPrices, uploadPrice, deletePrice, UPLOAD_DIR } from "../../controllers/price.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Разрешённые расширения/мимы
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ALLOWED_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

// ---------- Утилиты имени файла ----------

// 1) Попытка «размоджибачить»: latin1 -> utf8
function decodeLatin1ToUtf8(str = "") {
  try {
    // Buffer.from(..., 'latin1') = побайтно восстановим исходные UTF-8 байты
    return Buffer.from(str, "latin1").toString("utf8");
  } catch {
    return str;
  }
}

// 2) Выбор лучшего варианта: исходный vs перекодированный
function pickBestName(raw) {
  const fixed = decodeLatin1ToUtf8(raw);
  const letters = (s) => (s && s.match(/\p{L}/gu))?.length || 0;

  // Эвристика: берём тот, где больше «настоящих» букв
  // и нет символа замены �
  if (fixed && !fixed.includes("\uFFFD") && letters(fixed) >= letters(raw)) {
    return fixed;
  }
  return raw || "file";
}

// 3) Санитайз юникода, но с поддержкой кириллицы
function sanitizeUnicodeFilename(name) {
  let n = (name || "file").normalize("NFC");

  // убираем запрещённые для ФС и управляющие
  n = n.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "");

  // оставляем юникод-буквы/цифры/пробел/._-
  n = n.replace(/[^\p{L}\p{N}\s._-]+/gu, "");

  // схлопываем пробелы -> один пробел, trim
  n = n.replace(/\s+/g, " ").trim();

  // пробелы -> _
  n = n.replace(/ /g, "_");

  if (!n) n = "file";

  // ограничим длину
  if (n.length > 120) {
    const ext = path.extname(n);
    const base = path.basename(n, ext).slice(0, 110);
    n = `${base}${ext}`;
  }
  return n;
}

// ---------- Multer ----------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    // Всегда работаем с «починенным» именем
    const best = pickBestName(file.originalname || "file");
    const ext = path.extname(best).toLowerCase();
    const base = path.basename(best, ext);

    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : ".xlsx";
    const safeBase = sanitizeUnicodeFilename(base);

    const stamp = Date.now();
    cb(null, `${safeBase}__${stamp}${safeExt}`);
  }
});

// Фильтр по типу/миме — тоже на «починенном» имени
const fileFilter = (req, file, cb) => {
  const best = pickBestName(file.originalname || "");
  const ext = path.extname(best).toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error("Недопустимий тип файлу. Завантажте .xlsx, .xls або .csv"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ===== Маршруты =====
router.get("/", listPrices);
router.post("/upload", upload.single("file"), uploadPrice);
router.delete("/:id", deletePrice);

export default router;
