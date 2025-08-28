// routes/reviews.js
import express from 'express';
import Review from '../../models/Review.js';

const router = express.Router();

// Получение всех отзывов
// GET /admin/api/reviews
router.get('/', async (req, res) => {
    try {
      // Находим все отзывы и заполняем информацию о товаре
      const reviews = await Review.find().populate('product');
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

// Обновление видимости отзыва
// PUT /admin/api/reviews/:id/visibility
router.put('/:id/visibility', async (req, res) => {
  try {
    const { isVisible } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isVisible },
      { new: true }
    );
    if (!review) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удаление отзыва
// DELETE /admin/api/reviews/:id
router.delete('/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    res.json({ message: 'Отзыв удалён' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
