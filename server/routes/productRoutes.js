import express from "express";
import {
  getAllProducts,
  getAllProductsForm,
  getProductByTitleLink,
  getProductByGroupId
} from "../controllers/productController.js";
import { getProductById } from "../controllers/productController.js";
 import { getProductsByCategory } from "../controllers/productController.js";
import { getProductsBySearch } from "../controllers/productController.js";
import { getProductsByType } from "../controllers/productController.js";
import { getProductsByBrand } from "../controllers/productController.js";
import { getNewProducts } from "../controllers/productController.js";
import { getProducts } from "../controllers/productController.js";

const router = express.Router();

router.get("/get-products-by-id", getProductById);
router.get("/get-products-by-groupid", getProductByGroupId);
router.get("/get-product-by-titleLink", getProductByTitleLink);
router.get("/get-all-products", getAllProducts);
router.get("/get-all-products-form", getAllProductsForm);
router.get("/get-products-by-category", getProducts);
router.get("/get-products-by-search", getProducts);
router.get("/get-products-by-type", getProductsByType);
router.get("/get-products-by-brand", getProductsByBrand);
router.get("/get-new-products", getNewProducts);

export default router;
