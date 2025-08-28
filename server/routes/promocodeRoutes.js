// routes/promoCodeRoutes.js
import express from 'express';
import {
    usePromoCode
} from '../controllers/promocodeController.js';

const router = express.Router();

router.post('/use-promocode', usePromoCode);

export default router;