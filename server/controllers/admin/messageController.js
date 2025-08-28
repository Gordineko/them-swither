import Message from '../../models/Message.js'; // Убедитесь, что путь корректный

// Контроллер для создания сообщения
export const getMessages = async (req, res) => {
  try {
    // Получаем все сообщения, можно добавить сортировку по дате создания (от новых к старым)
    const messages = await Message.find().sort({ created_at: -1 });
    res.status(200).json({ data: messages });
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    res.status(500).json({ message: 'Ошибка при получении сообщений', error: error.message });
  }
};