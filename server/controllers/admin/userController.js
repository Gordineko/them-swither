import { User } from "../../models/User.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
// Получить всех пользователей
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Получить пользователя по _id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Зарегистрировать (создать) нового пользователя
export const createUser = async (req, res) => {
  console.debug("[DEBUG] Получены данные для создания пользователя:", req.body);

  // Извлекаем строковое значение пароля
  const passwordString = req.body.password && req.body.password.name;
  if (!passwordString) {
    console.error("[DEBUG] Пароль отсутствует или имеет неверный формат");
    return res.status(400).json({ message: "Неверный формат пароля" });
  }

  // Формируем объект пользователя с корректным полем password
  const userData = {
    ...req.body,
    password: passwordString, // используем строку, а не объект
  };

  const user = new User(userData);

  try {
    const newUser = await user.save();
    console.debug("[DEBUG] Пользователь успешно создан:", newUser);
    res.status(201).json(newUser);
  } catch (err) {
    console.error("[DEBUG] Ошибка при создании пользователя:", err);
    res.status(400).json({ message: err.message });
  }
};

// Обновить данные пользователя по _id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    let updateFields = {};

    // Преобразуем входные данные: если значение является объектом (например, number_phone),
    // то формируем поля вида "number_phone.name", "number_phone.title"
    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        if (typeof req.body[key] === "object" && req.body[key] !== null) {
          for (const subKey in req.body[key]) {
            if (req.body[key].hasOwnProperty(subKey)) {
              updateFields[`${key}.${subKey}`] = req.body[key][subKey];
            }
          }
        } else {
          updateFields[key] = req.body[key];
        }
      }
    }

    // Если передан новый пароль, хешируем его вручную
    if (updateFields.password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(updateFields.password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Удалить пользователя по _id
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // ваш SMTP-хост
  port: 465, // порт (обычно 587 или 465)
  auth: {
    user: "cosmeticsua0@gmail.com",
    pass: "pxbs ppsd pykl ybps",
  },
});

// Контроллер
export const toggleUserActivation = async (req, res) => {
  try {
    const { isPartner } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isPartner },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Если активируем — отправляем письмо
//     if (isActive) {
//       const mailOptions = {
//         from: '"Your App Team" <no-reply@yourdomain.com>', // от кого
//         to: user.email.name.replace(/['"]/g, "").trim(), // кому
//         subject: "Your Account Has Been Activated", // тема
//         html: `
// <div style="background-color: #f4f4f4; padding: 20px;">
//   <table align="center" width="100%" border="0" cellspacing="0" cellpadding="0"
//          style="max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif;">
//     <tr>
//       <td style="padding: 30px 30px 20px; text-align: center;">
//         <img src="https://i.postimg.cc/ncWhBKBB/logo.png" alt="PowerPro logo" width="240" />
//         <h2 style="margin: 16px 0 0; font-size: 22px; color: #000000;">
//           Ваш акаунт успішно активовано
//         </h2>
//       </td>
//     </tr>
//     <tr>
//       <td style="padding: 10px 30px 0; color: #000000; font-size: 16px;">
//         <p style="margin: 0 0 20px; text-align: center;">
//           Вітаємо, <strong>${user.email.name}</strong>!<br/>
//           Ваш акаунт було успішно активовано. Тепер ви можете увійти в систему та користуватись усіма можливостями платформи.
//         </p>
//         <p style="text-align: center; margin: 16px 0 32px; font-size: 14px; color: #000;">
//           Якщо у вас виникли питання, просто відповідайте на цей лист.
//         </p>
//       </td>
//     </tr>
//     <tr>
//       <td style="padding: 0 30px 30px; font-size: 14px; color: #333; text-align: left;">
//         <p style="margin: 0;">З повагою,</p>
//         <p style="margin: 0;">Команда <strong style="color:rgb(240, 9, 9);">PowerPro</strong></p>
//       </td>
//     </tr>
//   </table>
// </div>
//         `.trim(),
//       };

//       transporter.sendMail(mailOptions, (error, info) => {
//         if (error) {
//           console.error("Activation email failed:", error);
//         } else {
//           console.log("Activation email sent:", info.response);
//         }
//       });
//     }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
