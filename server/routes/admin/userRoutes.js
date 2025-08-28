import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserActivation
} from "../../controllers/admin/userController.js";
import orderRoutes from "./orderRoutes.js";

const router = express.Router();

// Эндпоинты для управления пользователями
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.put("/:id/toggle-activation", toggleUserActivation);
// Монтаж роутов заказов для пользователя
router.use("/:userId/orders", orderRoutes);
export default router;
