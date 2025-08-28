import express from "express";
import {
  getUserOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getAllOrders,
  getOrderForUserById,
  updateUserOrder,
  deleteUserOrder,
  updateOrderById,
  softDeleteOrder,
  restoreOrder,
} from "../../controllers/admin/orderController.js";

const router = express.Router({ mergeParams: true });

router.get("/", getUserOrders);
router.get("/get-all", getAllOrders);
router.get("/get-order/:id", getOrderById); // Получить заказ по ID
router.patch("/:id", updateOrder);
router.patch("/by-id/:id", updateOrderById);
router.delete('/:id', /* requireAdmin, */ softDeleteOrder);

// (опционально) восстановление
router.post('/:id/restore', /* requireAdmin, */ restoreOrder);
// router.put("/put-order/:id", updateOrder);
router.delete("/delete-order/:id", deleteOrder);
router.get("/:orderId", getOrderForUserById);
router.post("/", createOrder);
router.put("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);

export default router;
