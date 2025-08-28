// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String,  },
  linkName: { type: String},
  imageURL: { type: String },
  brands: { type: Array },
  subcategories: [{ name: String, linkName: String, brands: Array }],
  isVisible: { type: Boolean, default: true }  // новое поле для видимости
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
