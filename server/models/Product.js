import mongoose from 'mongoose';
import Settings from './admin/Settings.js';
// Общая схема для мультиязычных строк
const multiLangString = {
  ua: { type: String, default: '' },
  ru: { type: String, default: '' }
};

// Схема характеристики (key, value, unit)
const characteristicSchema = new mongoose.Schema({
  key: multiLangString,
  value: multiLangString,
  unit: multiLangString,
  isFilter: { type: Boolean, default: true }
}, { _id: false });

// Схема вариации (для товаров с разными опциями)
const variationSchema = new mongoose.Schema({
  option: multiLangString,               // Опция (цвет, мощность и т.п.)
  price: { type: Number },              // Цена вариации
  opt_price: { type: Number },              // Цена оптовая
  opt_price_uah: { type: Number },
  sku: { type: String },              // Уникальный артикул вариации
  code: { type: String },
  quantity: { type: Number, default: 1 },
  popular: { type: Number, default: 1 },
  manualSearchTags: {
    type: [String],
    default: []
  },
  description: multiLangString,
  img: [
    {
      img_link: { type: String },
      type: { type: String, enum: ['image', 'video'], default: 'image' }
    }
  ],
  video: { type: String },
  type: { type: String },
  isVisible: { type: Boolean, default: true },
  // Добавляем характеристики внутри вариации
  characteristics: {
    type: [characteristicSchema],
    default: []
  },
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { _id: true });

// Схема для полей динамических компонентов
const componentFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: multiLangString
}, { _id: false });

// Схема для строк динамических компонентов
const componentRowSchema = new mongoose.Schema({
  values: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  id: { type: Number },
  groupId: { type: Number, index: true },
  code: { type: Number },
  title: multiLangString,
  titleLink: { type: String },
  category: multiLangString,
  categoryLink: { type: String },
  subcategory: multiLangString,
  subcategoryLink: { type: String },
  country: multiLangString,
  unit: multiLangString,
  retailPrice: { type: Number },
  wholesalePrice: { type: Number },
  type: { type: String },
  isNew: { type: Boolean, default: false },
  types: { type: String },
  imageURL: { type: [String], default: [] },
  multiplicity: { type: Number, default: 1 },
  min_count: { type: Number, default: 1 },
  description: multiLangString,
  components: {
    type: {
      columns: [componentFieldSchema],
      rows: [componentRowSchema]
    },
    default: { columns: [], rows: [] }
  },
  isVisible: { type: Boolean, default: true },
  cost: { type: Number },
  opt_cost: { type: Number },
  opt_cost_uah: { type: Number },
  sku: { type: String },
  quantity: { type: Number },
  discount: { type: Number, default: 0 },
  weight: { type: Number },
  dimensions: {
    height: { type: Number },
    length: { type: Number },
    width: { type: Number }
  },
  // Добавляем поле вариаций с новой схемой variationSchema
  variations: {
    name: multiLangString,
    variations: [variationSchema]
  },
  // Характеристики на уровне продукта (берутся из активной вариации)
  characteristics: {
    type: [characteristicSchema],
    default: []
  },
  averageRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  // Новое ручное поле для «умного» поиска
  manualSearchTags: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Пре-хук для наполнения manualSearchTags
productSchema.pre('save', async function (next) {
  try {
    // Обновление manualSearchTags
    const tags = new Set(this.manualSearchTags || []);
    if (this.title?.ua) tags.add(this.title.ua.trim().toLowerCase());
    if (this.title?.ru) tags.add(this.title.ru.trim().toLowerCase());
    this.manualSearchTags = Array.from(tags);

    // Получаем текущий курс
    const setting = await Settings.findOne({ key: 'exchangeRate' });
    const rate = setting?.value || 40;

    // Пересчёт opt_cost_uah на основе USD
    if (typeof this.opt_cost === 'number') {
      this.opt_cost_uah = +(this.opt_cost * rate).toFixed(2);
    }

    // Пересчёт opt_price_uah для каждой вариации
    if (this.variations?.variations?.length) {
      this.variations.variations = this.variations.variations.map(v => {
        if (typeof v.opt_price === 'number') {
          v.opt_price_uah = +(v.opt_price * rate).toFixed(2);
        }
        return v;
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Product', productSchema);
