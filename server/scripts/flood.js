import mongoose from "mongoose";
import Product from "../models/Product.js";
import connectDB from '../config/db.js'

await connectDB();

const TARGET_KEYS = ["Ширина"];

function cleanValue(val) {
  if (typeof val !== "string") return val;
  return val.endsWith(".0") ? val.slice(0, -2) : val;
}

async function fixProducts() {
  const products = await Product.find({});
  console.log(`Найдено товаров: ${products.length}`);

  for (const product of products) {
    let changed = false;

    // === Глобальные характеристики ===
    if (Array.isArray(product.characteristics)) {
      for (const ch of product.characteristics) {
        if (TARGET_KEYS.includes(ch.key.ua) || TARGET_KEYS.includes(ch.key.ru)) {
          const cleanedUa = cleanValue(ch.value.ua);
          const cleanedRu = cleanValue(ch.value.ru);
          if (cleanedUa !== ch.value.ua || cleanedRu !== ch.value.ru) {
            ch.value.ua = cleanedUa;
            ch.value.ru = cleanedRu;
            changed = true;
          }
        }
      }
    }

    // === Характеристики в вариациях ===
    if (product.variations?.variations?.length) {
      for (const variation of product.variations.variations) {
        if (Array.isArray(variation.characteristics)) {
          for (const ch of variation.characteristics) {
            if (TARGET_KEYS.includes(ch.key.ua) || TARGET_KEYS.includes(ch.key.ru)) {
              const cleanedUa = cleanValue(ch.value.ua);
              const cleanedRu = cleanValue(ch.value.ru);
              if (cleanedUa !== ch.value.ua || cleanedRu !== ch.value.ru) {
                ch.value.ua = cleanedUa;
                ch.value.ru = cleanedRu;
                changed = true;
              }
            }
          }
        }
      }
    }

    if (changed) {
      await product.save();
      console.log(`Обновлён товар: ${product._id}`);
    }
  }

  console.log("✅ Обновление завершено");
  mongoose.connection.close();
}

fixProducts().catch(err => {
  console.error("Ошибка:", err);
  mongoose.connection.close();
});
