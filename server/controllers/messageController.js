import Message from '../models/Message.js'; // Убедитесь, что путь корректный

// Контроллер для создания сообщения
export const createMessage = async (req, res) => {
  try {
    const { client_name, phone, comment } = req.body;

   

    const newMessage = new Message({
      client_name,
      phone,
      comment
    });

    await newMessage.save();

    res.status(201).json({ message: 'Сообщение успешно создано', data: newMessage });
  } catch (error) {
    console.error('Ошибка при создании сообщения:', error);
    res.status(500).json({ message: 'Ошибка при создании сообщения', error: error.message });
  }
};