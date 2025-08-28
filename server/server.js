import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import utmRoutes from "./routes/utmRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import compareRoutes from "./routes/compareRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import promocodeRoutes from "./routes/promocodeRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import mongoose from "mongoose";
import { Order, User } from "./models/User.js";
import Product from "./models/Product.js";
import bidRoutes from './routes/bidRoutes.js'
import meestRoutes from './routes/meestRoutes.js'
import { getAccumulatedDiscount } from "./utils/getAccumulatedDiscount.js";
import characteristicRoutes from './routes/characteristicsRoutes.js'
import exportRoutes from './routes/exportRoutes.js'
import settingsRouter from "./routes/settingsRoutes.js";
import pricesRouter from "./routes/admin/prices.route.js";
// import liqpay from "liqpay-sdk-nodejs";
// const liqpays = new liqpay(
//   "sandbox_i38312250017",
//   "sandbox_FRDaasO0MmnhPbbp9U3d8DylKxr6ah8ppwkWKCcY"
// );

import productAdminRoutes from "./routes/admin/productRoutes.js";
import categoryAdminRoutes from "./routes/admin/categoryRoutes.js";
import userAdminRoutes from "./routes/admin/userRoutes.js";
import blogRoutes from "./routes/admin/blogRoutes.js";
import uploadRoutes from "./routes/admin/uploadRoutes.js";
import orderRoutesAdmin from "./routes/admin/orderRoutes.js";
import promoCodeAdminRoutes from "./routes/admin/promocodeRoutes.js";
import messageAdminRoutes from "./routes/admin/messageRoutes.js";
import rewievtositesRouter from './routes/reviews.js';
import exchangeRateAdminRoutes from './routes/admin/exchangeRateRoutes.js'
import reviewsRouter from './routes/admin/reviews.js';

const keycrmUrlStock = "https://openapi.keycrm.app/v1/order";
const keycrmToken = "NDUyZTNjNjk0OGM5NTc2YWYxNGIyN2YxYTIyYzM3YTQwMzUwNzQxZg";

const app = express();

app.use(
  cors({
    origin: true, // указываем конкретный источник
    credentials: true, // разрешаем отправку credentials (cookie, авторизационные заголовки и т.д.)
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

const users = [
  {
    id: 1,
    username: "admin",
    password: "admin775468871223",
    name: "Адміністратор",
  },

];

const SECRET_KEY = "your_secret_key_here";


const uploadDir = path.join(process.cwd(), 'public', 'uploads');

app.use("/uploads", express.static(uploadDir));

// роут прайсів
app.use("/admin/api/prices", pricesRouter);

app.use("/admin/api/orders", orderRoutesAdmin);
app.use("/admin/api/categories", categoryAdminRoutes);
app.use("/admin/api/products", productAdminRoutes);
app.use("/admin/api/users", userAdminRoutes);
app.use("/admin/api/reviews", reviewsRouter);
app.use("/admin/api/char", characteristicRoutes);
// app.use('/admin/api/integration', stockAdminRoutes);
// app.use('/admin/api/create', createProdAdminRoutes);
app.use("/admin/api/promocode", promoCodeAdminRoutes);
app.use("/admin/api/message", messageAdminRoutes);
app.use("/admin/api/exchange", exchangeRateAdminRoutes);
app.use("/api/reviews", rewievtositesRouter);
app.use("/api/bid", bidRoutes);
app.use("/api/meest", meestRoutes);
app.use("/api/export", exportRoutes);



app.post("/admin/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", username);
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) {
    console.log("Invalid credentials for", username);
    return res.status(401).json({ message: "Невірні дані для входу" });
  }
  // Создаём JWT (например, на 1 час)
  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name },
    SECRET_KEY,
    { expiresIn: "1h" }
  );
  // Устанавливаем токен в httpOnly cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  console.log("Login successful for", username);
  res.json({
    message: "Успішний вхід",
    token,
    user: { id: user.id, name: user.name },
  });
});

// Маршрут для выхода
app.post("/admin/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Вихід успішний" });
});

// Пример защищённого маршрута
app.get("/admin/api/protected", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    res.json({ message: "Protected content", payload });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/utm", utmRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/compare", compareRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/promocode", promocodeRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/settings", settingsRouter);


app.listen(5002, "0.0.0.0", () => {
  console.log("Server is running on port 5002");
});
