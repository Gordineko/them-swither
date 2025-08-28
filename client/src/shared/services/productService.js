// Получение всех продуктов

export const getAllProducts = async () => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/products/get-all-products"
    );
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      "Error fetching all products:",
      e
    );
    throw e;
  }
};

export const getProductsByGroup = async (
  groupId
) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/products/get-products-by-groupid?groupId=${groupId}`
    );
    if (!response.ok) {
      throw new Error(
        "Ошибка при получении товаров"
      );
    }
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Ошибка:", error.message);
  }
};

// Получение продукта по ID

export const getProductById = async (id) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/products/get-products-by-id?id=${id}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch product with ID: ${id}`
      );
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      `Error fetching product by ID (${id}):`,
      e
    );
    throw e;
  }
};

export const getProductByTitle = async (
  title
) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/products/get-product-by-titleLink?titleLink=${encodeURIComponent(
        title
      )}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch product with title: ${title}`
      );
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      `Error fetching product by title (${title}):`,
      e
    );
    throw e;
  }
};

// Получение продуктов по категории

// export const getProductsByCategory = async (

//   page,
//   limit,
//   category,
//   subcategory,
//   type,
//   brand,
//   cost,
//   sort
// ) => {
//   try {
//     // Создаём объект с основными параметрами
//     const params = new URLSearchParams({ page, limit, category, type });

//     // Если brand передан, добавляем его в параметры
//     if (brand) {
//       params.append("brand", brand);
//     }
//     if (subcategory) {
//       params.append("subcategory", subcategory);
//     }

//     // Если cost передан, добавляем его в параметры
//     if (cost) {
//       params.append("cost", cost);
//     }

//     // Если sort передан, добавляем его в параметры
//     if (sort) {
//       params.append("sort", sort);
//     }

//     const url = `http:// 192.168.0.106:5002/api/products/get-products-by-category?${params.toString()}`;

//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch products in category: ${category}`);
//     }
//     const data = await response.json();
//     return data;
//   } catch (e) {
//     console.error(`Error fetching products by category (${category}):`, e);
//     throw e;
//   }
// };

export const getProductsByCategory = async (
  page,
  limit,
  category,
  subcategory = null,
  brand,
  cost,
  sort,
  characteristicFilters
) => {
  try {
    const params = new URLSearchParams({
      page,
      limit,
    });

    if (category) {
      params.set("category", category);
      // params.set("type", type);
    }
    if (subcategory) {
      params.append("subcategory", subcategory);
    }

    if (brand) {
      params.append("brand", brand);
    }

    if (cost) {
      params.append("cost", cost);
    }

    if (sort && sort !== "default") {
      params.append("sort", sort);
    }

    if (characteristicFilters) {
      Object.entries(
        characteristicFilters
      ).forEach(([key, rawVal]) => {
        if (key === "format") return;
        if (!rawVal) return;

        if (
          Array.isArray(rawVal) &&
          rawVal.length
        ) {
          params.append(key, rawVal.join(","));
        } else if (typeof rawVal === "string") {
          params.append(key, rawVal);
        }
      });
    }

    const url = `http:// 192.168.0.106:5002/api/products/get-products-by-category?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch products in category: ${category}`
      );
    }

    const data = await response.json();

    // Фильтрация по isVisible === true
    if (
      data.products &&
      Array.isArray(data.products)
    ) {
      data.products = data.products.filter(
        (product) => product.isVisible === true
      );
    }

    return data;
  } catch (e) {
    console.error(
      `Error fetching products by category (${category}):`,
      e
    );
    throw e;
  }
};

export const getProductsBySearch = async (
  searchTerm,
  page,
  limit,
  cost,
  brand,
  type
) => {
  const paramsObj = {
    search: searchTerm,
    page,
    limit,
  };
  if (type !== undefined) {
    paramsObj.type = type;
  }
  if (brand !== undefined) {
    paramsObj.brand = brand;
  }
  if (cost !== undefined) {
    paramsObj.cost = cost;
  }

  const params = new URLSearchParams(paramsObj);

  try {
    const url = `http:// 192.168.0.106:5002/api/products/get-products-by-search?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch products for search term: ${searchTerm}`
      );
    }
    const data = await response.json();

    return data;
  } catch (e) {
    console.error(
      `Error fetching products by search term (${searchTerm}):`,
      e
    );
    throw e;
  }
};

export async function getProductsByType(type) {
  const response = await fetch(
    `http:// 192.168.0.106:5002/api/products/get-products-by-type?type=${type}`
  );
  if (!response.ok) {
    throw new Error(
      "Ошибка при получении продуктов по типу"
    );
  }
  const data = await response.json();
  return data; // Ожидается, что data содержит список продуктов, например: { products: [...] }
}
