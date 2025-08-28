import mongoose from 'mongoose';

const multiLangString = {
  ua: { type: String, default: "" },
  ru: { type: String, default: "" }
};

const BlogSchema = new mongoose.Schema({
  title:     multiLangString,
  slug:      { type: String,  unique: true },
  coverImage:{ type: String },
  content:   multiLangString,
  images:    { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Blog || mongoose.model('Blog', BlogSchema);