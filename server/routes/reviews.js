// routes/reviews.js
import express from "express";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import connectDB from "../config/db.js";

const router = express.Router();

router.get("/get-reviews/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    // Ищем отзывы для конкретного товара, дополнительно возвращаем только те, у которых isVisible = true
    const reviews = await Review.find({
      product: productId,
      isVisible: true,
    }).populate("product");
    console.log(productId)
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/post-reviews', async (req, res) => {
  try {
    await connectDB();
    const { author, rating, comment, product: productId } = req.body;

    if (!rating || !comment || !productId) {
      console.log('[DEBUG] Missing fields:', { rating, comment, productId });
      return res.status(400).json({ message: 'Необходимо указать рейтинг, комментарий и ID товара.' });
    }

    // 1) Создаем новый отзыв
    console.log('[DEBUG] Creating review for product:', productId);
    const review = new Review({ author, rating, comment, product: productId });
    const savedReview = await review.save();
    console.log('[DEBUG] Saved review:', savedReview);

    // 2) Добавляем review в массив reviews товара
    const updatePush = await Product.findOneAndUpdate(
      { _id: productId },
      { $push: { reviews: savedReview._id } },
      { new: true }
    );
    console.log('[DEBUG] Product after push reviews:', {
      productId,
      reviewsCount: updatePush.reviews.length,
      reviews: updatePush.reviews
    });

    // 3) Пересчитываем средний рейтинг и количество отзывов
    console.log('[DEBUG] Aggregating reviews for product:', productId);
        // 3) Пересчитываем средний рейтинг и количество отзывов
    console.log('[DEBUG] Aggregating reviews for product (including all or only visible):', productId);
    // Если нужно учитывать только видимые отзывы - раскомментируйте isVisible: true
    const aggregate = await Review.aggregate([
      { $match: { product: review.product /*, isVisible: true */ } },
      {
        $group: {
          _id: '$product',
          avg: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('[DEBUG] Aggregation result (ratings):', aggregate);
    console.log('[DEBUG] Aggregation result:', aggregate);

    const { avg = 0, count = 0 } = (aggregate[0] || {});
    console.log('[DEBUG] Computed avg and count:', { avg, count });

    // 4) Обновляем поля в документе Product
    const updateRatingResult = await Product.findByIdAndUpdate(
      productId,
      {
        averageRating: parseFloat(avg.toFixed(2)),
        ratingsCount: count
      },
      { new: true }
    );
    console.log('[DEBUG] Product after rating update:', {
      averageRating: updateRatingResult.averageRating,
      ratingsCount: updateRatingResult.ratingsCount
    });

    return res.status(201).json(savedReview);
  } catch (error) {
    console.error('[ERROR] Ошибка при создании отзыва:', error);
    return res.status(500).json({ message: 'Ошибка сервера при создании отзыва.' });
  }
});



export default router;
