
import express from "express";
import { createOrder, createLiqpayPayments, liqPayWebhook, createLocalOrder, createOneClickOrder } from "../controllers/orderController.js";
const router = express.Router();

router.post("/create-order", createOrder);
router.post("/create-local-order", createLocalOrder);
router.post("/create-click-order", createOneClickOrder);
router.post("/create-payment", createLiqpayPayments);
router.post("/webhook", liqPayWebhook);

export default router;

