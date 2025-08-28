
import express from "express";
import {
  getCompare,
  addToCompare,
  removeFromCompare,
  removeFromCompareByCategory,
  clearCompare
} from "../controllers/compareController.js";

const router = express.Router();

router.get("/get-compare", getCompare);
router.post("/add-to-compare", addToCompare);
router.post("/remove-from-compare", removeFromCompare);
router.patch("/remove-by-category", removeFromCompareByCategory);
router.post("/clear", clearCompare);

export default router;

