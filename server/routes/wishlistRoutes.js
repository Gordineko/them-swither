
import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController.js";

const router = express.Router();

router.get("/get-wishlist", getWishlist);
router.post("/add-to-wishlist", addToWishlist);
router.post("/remove-from-wishlist", removeFromWishlist);

export default router;

