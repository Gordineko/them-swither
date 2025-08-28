import nodemailer from "nodemailer";
import axios from "axios";
import mime from "mime";

export const smtpConfig = {
  host: "smtp.gmail.com",
  port: 465,
  user: "cosmeticsua0@gmail.com", // обратите внимание, нужно указать полный email
  pass: "pxbsppsdpyklybps", // ваш сгенерированный пароль приложения
};

export const appBaseUrl =
  "http:// 192.168.0.106:5002";

export async function sendResetEmail(
  toEmail,
  token
) {
  // 1. Скачиваем картинку по URL как ArrayBuffer
  const imageUrl =
    "https://i.postimg.cc/ncWhBKBB/logo.png";
  let base64Image = "";
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(
      response.data,
      "binary"
    );
    const mimeType =
      mime.getType(imageUrl) || "image/jpeg";
    base64Image = `data:${mimeType};base64,${buffer.toString(
      "base64"
    )}`;
  } catch (downloadErr) {
    console.error(
      "[sendResetEmail] Ошибка при скачивании изображения:",
      downloadErr
    );
    // Если не удалось скачать картинку, можно продолжить и вставить в письмо простой текст или пропустить изображение
    base64Image = null;
  }

  const { host, port, user, pass } = smtpConfig;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  // 2. Формируем HTML письма, подставляя base64-строку (если она есть)
  const htmlContent = `
    <div style="background-color: #f4f4f4; padding: 20px;">
      <table align="center" width="100%" border="0" cellspacing="0" cellpadding="0"
            style="max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif;">
        <tr>
          <td style="padding: 30px 30px 20px; text-align: center;">
            <img src="https://i.postimg.cc/wMgNHVCb/logo-t.png" alt="LEDTech logo" width="240" />
            <h2 style="margin: 16px 0 0; font-size: 22px; color: #000000;">
              Інструкція зі скидання пароля на сайті LEDTech
            </h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 30px 0; color: #000000; font-size: 16px;">
            <p style="margin: 0 0 20px; text-align: center;">
              Щоб скинути пароль, перейдіть за посиланням нижче:
            </p>
            <p style="word-break: break-all; text-align: center; margin: 16px 0 32px; font-size: 14px; color: #000;">
              ${appBaseUrl}/reset-password?token=${token}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 30px 30px; font-size: 14px; color: #333;">
            <p style="margin: 0;">З повагою,</p>
            <p style="margin: 0;">Команда <strong style="color:#fa0;">LEDTech</strong></p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const mailOptions = {
    from: `"Support" <${user}>`,
    to: toEmail,
    subject: "Відновлення пароля",
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(
      mailOptions
    );
    console.info(
      "[sendResetEmail] Message sent:",
      info.messageId
    );
  } catch (err) {
    console.error(
      "[sendResetEmail] Send Error:",
      err
    );
    throw err;
  }
}
