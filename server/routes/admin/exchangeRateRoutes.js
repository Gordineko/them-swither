import express from "express";
import Product from "../../models/Product.js";
import Settings from "../../models/admin/Settings.js";

const router = express.Router();

// GET /api/settings/exchange-rate
router.get("/exchange-rate", async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: "exchangeRate" });
    if (!setting) {
      return res.status(404).json({ message: "Exchange rate not found" });
    }
    res.json({ exchangeRate: setting.value });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/settings/exchange-rate
router.put("/exchange-rate", async (req, res) => {
  try {
    const { newExchangeRate } = req.body;
    if (!newExchangeRate || typeof newExchangeRate !== "number") {
      return res.status(400).json({ message: "Invalid exchange rate" });
    }

    // 1) Сохраняем новый курс
    const setting = await Settings.findOneAndUpdate(
      { key: "exchangeRate" },
      { value: newExchangeRate },
      { new: true, upsert: true }
    );

    // 2) Берём все продукты с USD-полями
    const products = await Product.find(
      {},
      "opt_cost variations.variations.opt_price"
    );

    let updatedProducts = 0;
    let updatedVariations = 0;

    for (const product of products) {
      const bulk = {};

      // Пересчёт opt_cost_uah на основе USD
      if (typeof product.opt_cost === "number") {
        bulk.opt_cost_uah = +(product.opt_cost * newExchangeRate).toFixed(2);
        updatedProducts++;
      }

      // Пересчёт opt_price_uah в вариациях
      if (
        product.variations &&
        Array.isArray(product.variations.variations)
      ) {
        product.variations.variations.forEach((v, i) => {
          if (typeof v.opt_price === "number") {
            bulk[`variations.variations.${i}.opt_price_uah`] =
              +(v.opt_price * newExchangeRate).toFixed(2);
            updatedVariations++;
          }
        });
      }

      // Если есть что обновлять — делаем прямой апдейт
      if (Object.keys(bulk).length > 0) {
        await Product.updateOne(
          { _id: product._id },
          { $set: bulk }
        );
      }
    }

    res.status(200).json({
      message: "Exchange rate updated and UAH prices recalculated",
      exchangeRate: setting.value,
      updatedProducts,
      updatedVariations
    });
  } catch (error) {
    console.error("Error updating exchange rate:", error);
    res.status(500).json({ message: error.message });
  }
});


export default router;
