// controllers/characteristics.js (ESM)
import { CharacteristicKey, CharacteristicUnit } from '../models/characteristicModels.js';

// --- KEYS ---
export const getAllKeys = async (req, res) => {
  const keys = await CharacteristicKey.find();
  res.json(keys);
};

export const createKey = async (req, res) => {
  const { value, label } = req.body;
  const key = await CharacteristicKey.create({ value, label });
  res.json(key);
};

export const updateKey = async (req, res) => {
  const { id } = req.params;
  const { value, label } = req.body;
  const key = await CharacteristicKey.findByIdAndUpdate(id, { value, label }, { new: true });
  res.json(key);
};

export const deleteKey = async (req, res) => {
  const { id } = req.params;
  await CharacteristicKey.findByIdAndDelete(id);
  res.json({ success: true });
};

// --- UNITS ---
export const getAllUnits = async (req, res) => {
  const units = await CharacteristicUnit.find();
  res.json(units);
};

export const createUnit = async (req, res) => {
  const { value, label } = req.body;
  const unit = await CharacteristicUnit.create({ value, label });
  res.json(unit);
};

export const updateUnit = async (req, res) => {
  const { id } = req.params;
  const { value, label } = req.body;
  const unit = await CharacteristicUnit.findByIdAndUpdate(id, { value, label }, { new: true });
  res.json(unit);
};

export const deleteUnit = async (req, res) => {
  const { id } = req.params;
  await CharacteristicUnit.findByIdAndDelete(id);
  res.json({ success: true });
};
