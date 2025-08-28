// characteristicModels.js
import mongoose from 'mongoose';

// Схема для ключей характеристик
const KeySchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },
  label: {
    ua: { type: String, required: true },
    ru: { type: String, required: true }
  }
}, { collection: 'characteristic_keys' });

// Схема для единиц измерения
const UnitSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },
  label: {
    ua: { type: String, required: true },
    ru: { type: String, required: true }
  }
}, { collection: 'characteristic_units' });

export const CharacteristicKey = mongoose.model('CharacteristicKey', KeySchema);
export const CharacteristicUnit = mongoose.model('CharacteristicUnit', UnitSchema);
