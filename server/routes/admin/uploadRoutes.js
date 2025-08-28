import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Image upload endpoint
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  // протокол (http или https)
  const protocol = req.protocol;

  const host = req.get("host");
  // путь к файлу относительно папки public
  const filePath = `/uploads/${req.file.filename}`;
  // собираем полный URL
  const url = `${protocol}://${host}${filePath}`;
  res.json({ url });
});

export default router;
