// routes/admin/settings.js
import { Router } from "express";
import {
  getOrderId,
  setOrderId,
  nextOrderId,
} from "../controllers/settingController.js";

const router = Router();

router.get("/order-id", getOrderId);          // получить текущее значение
router.put("/order-id", setOrderId);          // установить значение
router.post("/order-id/next", nextOrderId);   // получить следующий (атомарно)

export default router;
