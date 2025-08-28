import mongoose from 'mongoose';
import Counter from './Counter.js';

const variationSchema = new mongoose.Schema({
  option: { type: String },
  price: { type: Number },
  sku: { type: String },                   // Цена в гривнах (будет рассчитана)
}, { _id: false }); // _id: false если не нужна отдельная идентификация каждой вариации

const productSchema = new mongoose.Schema({
  id: { type: Number },
  title: { type: String },
  titleLink: { type: String, },
  category: { type: String },
  categoryLink: { type: String },
  subcategory: { type: String },
  subcategoryLink: { type: String },
  brand: { type: String },
  imageURL: { type: [String], default: [] },
  description: { type: String, default: null },
  features: { type: Array, default: [] },
  application: [{
    name: {
      type: String,
    },
    image: { type: String }
  }],
  cost: { type: Number },
  sku: { type: String, required: false },
  quantity: { type: Number },
  discount: { type: Number, default: 0 },
  type: { type: String },
  variation: {
    name: { type: String },
    variations: { type: [variationSchema], default: [] } // Массив поддокументов вариации с ценой
  }
});

productSchema.pre('save', async function (next) {
  try {
    // Если документ новый, генерируем уникальный id
    if (this.isNew) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "productId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.id = counter.seq;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;