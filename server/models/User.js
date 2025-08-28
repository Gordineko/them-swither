import mongoose from "mongoose";
import { type } from "os";

// Повторно используемые подписи
const multiLangString = {
  ua: { type: String, default: "" },
  ru: { type: String, default: "" },
};
const variationSchema = new mongoose.Schema(
  {
    option: multiLangString, // Опция (цвет, мощность и т.п.)
    price: { type: Number }, // Цена вариации
    opt_price: { type: Number },
    sku: { type: String }, // Уникальный артикул вариации
    code: { type: Number },
    quantity: { type: Number },
    img: [
      {
        img_link: { type: String },
        type: { type: String, enum: ["image", "video"], default: "image" },
      },
    ],
  },
  { _id: false }
);
// Уже определённые схемы
// const variationSchema = new Schema({ … }, { _id: false });
// const componentFieldSchema = new Schema({ … }, { _id: false });
// const componentRowSchema = new Schema({ … }, { _id: false });

const productSubschema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Базовые параметры товара
    code: { type: Number },
    sku: { type: String, default: "" },
    title: multiLangString,
    titleLink: { type: String, default: "" },
    subTitle: multiLangString,
    titleDescription: multiLangString,

    // Категории и бренд
    category: multiLangString,
    categoryLink: { type: String, default: "" },
    subcategory: multiLangString,
    subcategoryLink: { type: String, default: "" },
    brand: multiLangString,
    brandLink: { type: String, default: "" },

    // Изображения и основные описания
    imageURL: { type: [String], default: [] },
    description: multiLangString,
    composition: multiLangString,
    application: multiLangString,

    // Характеристики
    characteristics: {
      type: [
        {
          key: multiLangString,
          value: multiLangString,
          unit: multiLangString,
        },
      ],
      default: [],
    },

    // Цены и количество
    cost: { type: Number, default: 0 },
    opt_cost: { type: Number, default: 0 },
    quantity: { type: Number, min: 0, default: 1 },
    discount: { type: Number, default: 0 },
    purchased_price: { type: Number, min: 0, default: 0 },
    weightQuantity: { type: Number, default: 0 },

    // Вариации
    variations: {
      name: multiLangString,
      variations: [variationSchema],
    },
    selectedVariation: { type: mongoose.Schema.Types.Mixed, default: null },
    selectedVariations: {
      type: mongoose.Schema.Types.Mixed, default: null,
      default: []
    },
    // Компоненты (если нужно)
    // components: {
    //     type: {
    //         columns: [componentFieldSchema],
    //         rows: [componentRowSchema]
    //     },
    //     default: { columns: [], rows: [] }
    // }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isPartner: {type: Boolean, default: true},
  managerComment: { type: String },
  crmId: { type: Number },
  order_number: { type: String },
  products: [
    {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  ],
  totalCost: { type: Number },
  totalCostWithoutDiscount: { type: Number },
  number_phone: { type: String },
  firstname: { type: String },
  lastname: { type: String },
  email: { type: String },
  ordered_at: { type: Date, default: Date.now },
  user_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  customer: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  delivery: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  payment: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: { type: String, default: "Новий" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const userSchema = new mongoose.Schema(
  {
    number_phone: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Номер телефону" },
        ru: { type: String, default: "Номер телефона" },
      },
    },
    firstname: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Ім'я" },
        ru: { type: String, default: "Имя" },
      },
    },
    lastname: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Прізвище" },
        ru: { type: String, default: "Фамилия" },
      }, // необязательное поле для заголовка или описания
    },
    email: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "E-mail" },
        ru: { type: String, default: "E-mail" },
      }, // необязательное поле для заголовка или описания
    },
    password: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Пароль" },
        ru: { type: String, default: "Пароль" },
      }, // необязательное поле для заголовка или описания
    },
    city: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Місто" },
        ru: { type: String, default: "Город" },
      }, // необязательное поле для заголовка или описания
    },
    warehouse: {
      name: { type: String, default: "" },
      title: {
        ua: { type: String, default: "Відділення пошти" },
        ru: { type: String, default: "Отделение почты" },
      }, // необязательное поле для заголовка или описания
    },
    cart: [productSubschema],
    orders: [orderSchema],
    deliveryInfo: {
      area: String,
      city: String,
      warehouse: String,
    },
    promoCodes: [
      {
        title: { type: String },
        discount: { type: Number },
        validUntil: { type: Date, default: Date.now },
        quantity: { type: Number },
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    compare: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    totalSpent: {
      type: Number,
      default: 0,
    },
    // Накопительная скидка (кумулятивная скидка для постоянных клиентов)
    accumulatedDiscount: {
      type: Number,
      default: 0,
    },
    personalDiscount: {
      type: Number,
      default: 0,
    },
    isPartner: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export const Order = mongoose.model("Order", orderSchema);
