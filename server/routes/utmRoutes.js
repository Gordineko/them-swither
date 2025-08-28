import express from "express";
import { registerUTM } from "../controllers/utmController.js";

const router = express.Router();

router.post("/register-utm", registerUTM);

export default router;
