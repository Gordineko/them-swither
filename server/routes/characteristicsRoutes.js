// routes/characteristics.js (ESM)
import express from 'express';
import * as ctrl from '../controllers/characteristicsController.js';

const router = express.Router();

// KEYS
router.get('/keys', ctrl.getAllKeys);
router.post('/keys', ctrl.createKey);
router.put('/keys/:id', ctrl.updateKey);
router.delete('/keys/:id', ctrl.deleteKey);

// UNITS
router.get('/units', ctrl.getAllUnits);
router.post('/units', ctrl.createUnit);
router.put('/units/:id', ctrl.updateUnit);
router.delete('/units/:id', ctrl.deleteUnit);

export default router;
