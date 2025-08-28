import mongoose from 'mongoose';

// Ссылка на модель Product для привязки отзыва к товару
const reviewSchema = new mongoose.Schema({
  author: { type: String }, // Можно расширить до ObjectId, если нужно связать с пользователем
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  isVisible: { type: Boolean, default: false },  // Отзыв не показывается на сайте до модерации
  createdAt: { type: Date, default: Date.now },
  // Привязка отзыва к товару
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;