import Bid from '../models/Bid.js';
import axios from 'axios';

const telegramToken = '8300960022:AAEBTHzDRiWnyEXPmalMR0zbWowCxRmuufQ';
const channelId = '-1002754415555';

export const createBid = async (req, res) => {
  try {
    const { name, phone, question, product, formType, email, company, site } = req.body;

    // Валидация formType
    const allowed = ['contact', 'callback', 'partner'];
    if (!allowed.includes(formType)) {
      return res.status(400).json({ message: 'Invalid formType' });
    }

    // Сохраняем в БД
    const newBid = new Bid({ name, phone, question, formType });
    await newBid.save();

    // Определяем подпись
    let caption;
    switch (formType) {
      case 'contact':
        caption = 'Заявка на питання';
        break;
      case 'callback':
        caption = 'Заявка наявності товару';
        break;
      case 'partner':
        caption = 'Заявка стати партнером';
        break;
    }

    // Формируем сообщение в Telegram
    const lines = [
      `<b>${caption}</b>`,
      `<b>Клієнт:</b> ${name}`,
      `<b>Телефон:</b> ${phone}`,
      email && `<b>Email:</b> ${email}`,
      company && `<b>Компанія:</b> ${company}`,
      site && `<b>Сайт компанії:</b> ${site}`,
      question && `<b>Запитання:</b> ${question}`,
      product && `<b>Товар:</b> ${product.title.ua}`,
    ].filter(Boolean);

    const text = lines.join('\n');

    // Отправляем
    await axios.post(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      { chat_id: channelId, text, parse_mode: 'HTML' }
    );

    return res.status(201).json({ message: 'Заявка принята', data: newBid });
  } catch (error) {
    console.error('Ошибка при создании заявки:', error);
    return res.status(500).json({ message: error.message });
  }
};
