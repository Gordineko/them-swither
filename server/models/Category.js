import mongoose from "mongoose";

// Объявляем «универсальную» мультиязычную строку
const multiLangString = {
  ua: { type: String, default: "" },
  ru: { type: String, default: "" }
};


// Вложенная схема для подкатегории (Subcategory)
const SubcategorySchema = new mongoose.Schema({
  name: {
    type: multiLangString,

  },
  linkName: {
    type: String,

  },
  imageURL: { type: String },
  order: { type: Number }
});

// Основная схема категории
const CategorySchema = new mongoose.Schema({
  name: {
    type: multiLangString,

  },
  linkName: {
    type: String,

    unique: true
  },
  imageURL: { type: String },
  isVisible: { type: Boolean, default: true },
  order: { type: Number },
  // Здесь subcategories — массив SubcategorySchema
  subcategories: {
    type: [SubcategorySchema],
    default: []
  }
}, { timestamps: true });

export default mongoose.model("Category", CategorySchema);
