import express from "express";
import {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
  clearCart
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/get-cart", getCart);
router.post("/add-to-cart", addToCart);
router.post("/remove-from-cart", removeFromCart);
router.post("/update-qty", updateCartItemQuantity);
router.post("/clear-cart", clearCart);


export default router;