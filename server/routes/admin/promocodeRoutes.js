// routes/promoCodesRoutes.js
import express from 'express';
import { getPromoCodes, addPromoCode, updatePromoCode, removePromoCode } from '../../controllers/admin/promocodeController.js';

const router = express.Router({ mergeParams: true });

// Получение всех промокодов пользователя
router.get('/:userId/get-promocodes', getPromoCodes);
// Добавление нового промокода
router.post('/:userId/promocodes', addPromoCode);
// Обновление промокода
router.put('/:userId/promocodes/:promoCodeId', updatePromoCode);
// Удаление промокода
router.delete('/:userId/promocodes/:promoCodeId', removePromoCode);

export default router;
