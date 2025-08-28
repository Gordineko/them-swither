import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const JWT_SECRET = "your_jwt_secret_key";

// Регистрация пользователя
export const registerUser = async (req, res) => {
  try {
    console.log("Запрос на регистрацию:", req.body);

    const { email, firstname, password } = req.body;

    if (!email || !firstname || !password) {
      console.log("Ошибка: не все обязательные поля заполнены.");
      return res
        .status(400)
        .json({ message: "Заповніть всі обов'язкові поля" });
    }

    console.log("Поиск существующего пользователя по email...");
    const existingUser = await User.findOne({ "email.name": email });

    if (existingUser) {
      console.log("Ошибка: пользователь уже существует:", existingUser);
      return res
        .status(400)
        .json({ message: "Користувач з таким email вже існує" });
    }

    console.log("Хеширование пароля...");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Создание нового пользователя...");
    const newUser = new User({
      firstname: { name: firstname },
      email: { name: email },
      password: { name: hashedPassword },
    });

    console.log("Сохранение пользователя в базу данных...");
    await newUser.save();

    console.log("Пользователь успешно зарегистрирован:", newUser);
    res.status(201).json({ message: "Користувач успішно зареєстрований" });
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    res
      .status(500)
      .json({ message: "Помилка реєстрації", error: error.message });
  }
};

// Вход пользователя
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  console.log("DEBUG: Вызов loginUser для email:", email);

  try {
    const user = await User.findOne({ "email.name": email });
    if (!user) {
      console.log("DEBUG: Пользователь с таким email не найден:", email);
      return res
        .status(400)
        .json({ message: "Користувача з таким email не знайдено" });
    }

    if (user.isActive === false) {
      console.log("DEBUG: Пользователь еще не активирован:", email);
      return res.status(403).json({
        message:
          "Ваш акаунт ще не активовано. Зачекайте на активацію від адміністратора.",
      });
    }

    console.log("DEBUG: Пользователь найден:", user.password);

    const isPasswordValid = await bcrypt.compare(password, user.password.name);
    if (!isPasswordValid) {
      console.log("DEBUG: Неверный пароль для email:", email);
      return res.status(400).json({ message: "Неправильний пароль" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "100d" });
    console.log(
      "DEBUG: Токен создан для пользователя. id:",
      user._id,
      "Токен:",
      token
    );
    res.json({ token, id: user._id, isPartner: user.isPartner, discount: user.accumulatedDiscount });
  } catch (error) {
    console.error("DEBUG: Ошибка в loginUser:", error);
    res.status(500).json({ message: "Помилка при вході" });
  }
};

export const getInformationForUserAccount = async (req, res) => {
  try {
    // Застосовуємо populate до поля wishlist, щоб отримати повні дані товарів
    const user = await User.findById(req.user.id).populate("wishlist");
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    console.log(user.promoCodes, user.wishlist);
    res.json({
      number_phone: user.number_phone,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      orders: user.orders,
      area: user.deliveryInfo.area,
      city: user.city,
      warehouse: user.warehouse,
      promoCodes: user.promoCodes,
      wishlist: user.wishlist, // тепер це масив об'єктів товарів
      discount: user.accumulatedDiscount,
      totalSpent: user.totalSpent,
      isPartner: user.isPartner
    });
  } catch (error) {
    res.status(500).json({
      message: "Помилка при отриманні даних користувача",
    });
  }
};

// Получение информации для корзины пользователя
export const getInformationForUserCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    res.json({
      cart: user.cart,
    });
  } catch (error) {
    res.status(500).json({
      message: "Помилка при отриманні даних користувача",
    });
  }
};

// Обновление информации о пользователе
export const updateUserInformation = async (req, res) => {
  try {
    console.log(req.body);
    const {
      userId,
      firstname,
      lastname,
      email,
      number_phone,
      city,
      coment,
      warehouse,
    } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        "firstname.name": firstname,
        "lastname.name": lastname,
        "email.name": email,
        "number_phone.name": number_phone,
        "city.name": city,
        "warehouse.name": warehouse,
      },
      { new: true } // Возвращает обновлённый объект
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    res.json({ message: "Дані оновлено успішно", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Помилка при оновленні даних користувача",
    });
  }
};

// Обновление информации о доставке
export const updateDeliveryInformation = async (req, res) => {
  const { area, city, warehouse } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    user.deliveryInfo = { area, city, warehouse };
    await user.save();

    res.status(200).json({
      message: "Дані доставки успішно оновлено",
      user,
    });
  } catch (error) {
    console.error("Помилка при оновленні даних доставки:", error);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};
