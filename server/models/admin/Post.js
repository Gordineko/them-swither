// models/Post.js
import mongoose from 'mongoose';

const PostSchema = new mongoose.Schema({
  title: { type: String,  },
  content: { type: String,  },   // HTML из редактора
  images: [String],                             // URL загруженных картинок
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Post || mongoose.model('Post', PostSchema);
