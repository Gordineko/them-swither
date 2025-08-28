import express from "express";
import { createBid } from "../controllers/bidController.js";

const router = express.Router();

router.post("/create-bid", createBid);

export default router;
