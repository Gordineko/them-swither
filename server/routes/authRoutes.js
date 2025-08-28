import express from "express";
import {
  registerUser, loginUser, getInformationForUserAccount,
  getInformationForUserCart,
  updateUserInformation,
  updateDeliveryInformation,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import crypto from "crypto";
import { sendResetEmail } from "../utils/sendResetEmail.js";


import { User } from "../models/User.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/register-user", registerUser);
router.post("/login-user", loginUser);
router.post("/logout-user", authenticateToken, (req, res) => {
  res.json({ message: "Ви вийшли з акаунту" });
});
router.get("/get-information-for-user-account", authenticateToken, getInformationForUserAccount);

// Роут для получения информации о корзине пользователя
router.get("/get-information-for-user-cart", authenticateToken, getInformationForUserCart);

// Роут для обновления информации о пользователе
router.put("/update-user-information", updateUserInformation);

// Роут для обновления информации о доставке
router.put("/update-delivery-information", authenticateToken, updateDeliveryInformation);

router.post('/forgot-password', async (req, res) => {
  console.log('▶️ [forgot-password] Запрос:', req.body);

  const { email } = req.body;
  if (!email) {
    console.warn('⚠️ [forgot-password] Пустой email');
    return res.status(400).json({ message: 'Email обов’язковий' });
  }

  try {
    const user = await User.findOne({ 'email.name': email.toLowerCase() });

    if (!user) {
      console.warn('⚠️ [forgot-password] Пользователь не найден:', email);
      return res.status(500).json({ message: 'Користувача з таким email не знайдено' });
    }
    console.log('🔍 [forgot-password] User found:', user ? user._id : null);

    // Удаляем старые токены
    const deleted = await PasswordResetToken.deleteMany({ userId: user?._id });
    console.log(`🗑️ [forgot-password] Удалено старых токенов: ${deleted.deletedCount}`);

    // Генерируем новый
    const token = crypto.randomBytes(32).toString('hex');
    const prt = new PasswordResetToken({ userId: user._id, token });
    await prt.save();
    console.log('🆕 [forgot-password] Новый токен сохранён:', prt.token);

    // Отправляем письмо
    await sendResetEmail(user.email.name, token);
    console.log('✉️ [forgot-password] Письмо отправлено на:', user.email);

    return res.json({ message: 'Якщо такий користувач існує, Ви отримаєте лист.' });
  } catch (err) {
    console.error('💥 [forgot-password] Ошибка:', err);
    return res.status(500).json({ message: 'Сталася помилка, спробуйте пізніше' });
  }
});


router.post('/reset-password', async (req, res) => {
  console.log('▶️ [reset-password] Запрос:', req.body);

  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token та password обов’язкові' });
  }

  try {
    // Find reset record
    const record = await PasswordResetToken.findOne({ token });
    console.log('🔍 [reset-password] Token record:', record);

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Токен недійсний або прострочений' });
    }

    // Find user
    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Hash new password
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    user.password.name = hash;
    await user.save();
    console.log('✅ [reset-password] Password updated for user:', user._id);

    // Delete used token
    await PasswordResetToken.deleteOne({ _id: record._id });

    res.json({ message: 'Пароль успішно оновлено' });
  } catch (err) {
    console.error('💥 [reset-password] Error:', err);
    res.status(500).json({ message: 'Сталася помилка, спробуйте пізніше' });
  }
});

export default router;