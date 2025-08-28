// src/shared/services/productService.cjs

// Если вы используете Node.js ≥18, fetch уже встроен.
// Иначе установите и раскомментируйте строку ниже:
// const fetch = require('node-fetch');

async function getAllProducts() {
  try {
    const response = await fetch(

      `${process.env.NEXT_PUBLIC_API_URL}/api/products/get-all-products-form`

    );
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Error fetching all products:", e);
    throw e;
  }
};

module.exports = { getAllProducts };
