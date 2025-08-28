// routes/posts.js
import express from 'express';
import Post from '../../models/admin/Post.js';

const router = express.Router();

// Создать новую новость
router.post('/', async (req, res) => {
  try {
    const post = new Post(req.body);
    await post.save();
    res.status(201).json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Получить все новости
router.get('/', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// Получить одну новость
router.get('/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.json(post);
});

// Обновить новость
router.put('/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(post);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Удалить новость
router.delete('/:id', async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
