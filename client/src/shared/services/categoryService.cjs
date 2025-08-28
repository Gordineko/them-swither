// src/shared/services/categoryService.cjs

// Если в вашей среде Node.js нет глобального fetch,
// раскомментируйте строку ниже и установите node-fetch:
// const fetch = require('node-fetch');

async function getAllCategory() {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/categories/get-categories"
    );
    if (!response.ok) {
      throw new Error("Failed to fetch category");
    }
    const data = await response.json();

    // Фильтруем видимые категории
    const visibleCategories = Array.isArray(data)
      ? data.filter(
          (category) =>
            category.isVisible === true
        )
      : [];

    return visibleCategories;
  } catch (e) {
    console.error(
      "Error fetching all category:",
      e
    );
    throw e;
  }
}

module.exports = { getAllCategory };
