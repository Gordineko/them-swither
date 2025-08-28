import Product from "../models/Product.js";
import Category from "../models/Category.js";

// Получение продуктов по id
export const getProductById = async (req, res) => {
  const { id } = req.query;
  try {
    if (!id) {
      return res.status(400).json({ message: "id продукту є обовʼязковою" });
    }

    const products = await Product.find({ id });
    if (products.length === 0) {
      return res.status(404).json({ message: "Продукт не знайдено" });
    }

    res.json(products[0]);
  } catch (error) {
    res.status(500).json({ message: "Помилка отримання даних", error });
  }
};

export const getProductByGroupId = async (req, res) => {
  const { groupId } = req.query;
  try {
    if (!groupId) {
      return res.status(400).json({ message: "groupId продукту є обовʼязковою" });
    }

    const products = await Product.find({ groupId });
    if (products.length === 0) {
      return res.status(404).json({ message: "Продукт не знайдено" });
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Помилка отримання даних", error });
  }
};

export const getProductByTitleLink = async (req, res) => {
  const { titleLink } = req.query;
  try {
    if (!titleLink) {
      return res.status(400).json({ message: "titleLink продукту є обовʼязковою" });
    }

    // Находим продукт без populate
    const product = await Product.findOne({ titleLink }).lean();

    if (!product) {
      return res.status(404).json({ message: "Продукт не знайдено" });
    }

    // Соберём все relatedProducts ids из всех вариаций (вложенные)
    const allRelatedIds = [];
    for (const variation of (product.variations?.variations || [])) {
      if (Array.isArray(variation.relatedProducts)) {
        for (const rid of variation.relatedProducts) {
          if (rid) allRelatedIds.push(String(rid));
        }
      }
    }

    // Уникальные id
    const uniqueIds = [...new Set(allRelatedIds)];

    // Подгружаем одним запросом все связанные продукты
    let relatedProductsMap = {};
    if (uniqueIds.length) {
      const relatedProducts = await Product.find({ _id: { $in: uniqueIds } })
        .select('_id title sku code imageURL titleLink variations unit')
        .lean();

      relatedProducts.forEach(p => {
        const firstVar = p.variations?.variations?.[0];
        p.price = firstVar?.price || 0;
        p.opt_price_uah = firstVar?.opt_price_uah || 0;
        p.quantity = firstVar?.quantity || 0;
      });
      relatedProductsMap = Object.fromEntries(
        relatedProducts.map(p => [String(p._id), p])
      );
    }

    // Вставляем связанные продукты прямо в вариации, новое поле relatedProductsData
    const filledVariations = (product.variations?.variations || []).map(variation => ({
      ...variation,
      relatedProductsData: (variation.relatedProducts || [])
        .map(rid => relatedProductsMap[String(rid)]).filter(Boolean)
    }));

    // Собираем итоговый ответ
    const result = {
      ...product,
      variations: {
        ...product.variations,
        variations: filledVariations
      }
    };

    res.json(result);

  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    res.status(500).json({ message: "Помилка отримання даних", error });
  }
};


// Получение продуктов по категории

// GET /api/products/get-products-by-category?page=1&limit=10&category=Skin Care

// export const getProductsByCategory = async (req, res) => {
//   try {
//     console.log(req.query);
//     const { page = 1, limit = 10, category, type } = req.query;
//     const skip = (page - 1) * limit;

//     // Создаем фильтр для запроса
//     const filter =
//       type == "subcategory"
//         ? { subcategoryLink: category }
//         : { categoryLink: category };

//     const products = await Product.find(filter).skip(skip).limit(Number(limit));

//     const count = await Product.countDocuments(filter);

//     res.json({
//       products,
//       count,
//       page: Number(page),
//       totalPages: Math.ceil(count / limit),
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Ошибка при получении товаров" });
//   }
// };

// src/controllers/admin/productController.js

export const getProductsByCategory = async (req, res) => {
  try {
    const {
      search = "",
      brand,
      category,
      cost,
      sort = "default",
      page,
      limit,
      subcategory,
      ...otherFilters
    } = req.query;

    // 1) Нормализуем параметр sort и логируем
    const sortParam = Array.isArray(sort) ? sort[0] : sort;
    console.log("🔍 sortParam:", sortParam, "(type:", typeof sortParam, ")");

    // 2) Парсим пагинацию
    let pageNumber = parseInt(page, 10);
    if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;
    let limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber < 1) limitNumber = 10;
    const skip = (pageNumber - 1) * limitNumber;

    // 3) Базовый match для видимых товаров
    const matchBase = { isVisible: true };

    // 4) Поиск по SKU или тексту
    if (search) {
      const isSKU = /\d{5}/.test(search);
      const escaped = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
      const regex = new RegExp(isSKU ? search : `(^|\\s)${escaped}`, "i");
      const searchQuery = isSKU
        ? { sku: { $regex: regex } }
        : {
          $or: [
            { "title.ua": { $regex: regex } },
            { "title.ru": { $regex: regex } }
          ]
        };
      Object.assign(matchBase, searchQuery);
    }

    // 5) Фильтр по бренду
    if (brand) {
      const brands = Array.isArray(brand)
        ? brand
        : brand.includes(",")
          ? brand.split(",").map(b => b.trim())
          : [brand];
      matchBase["brand.brandLink"] = { $in: brands };
    }

    // 6) Фильтр по категории / подкатегории
    if (category) {
      const link = Array.isArray(category) ? category[0] : category;
      if (subcategory && subcategory !== "undefined" && subcategory !== category) {
        matchBase.subcategoryLink = subcategory.trim();
      } else {
        matchBase.categoryLink = link;
        const catDoc = await Category.findOne({ linkName: link }).lean();
        const visibleSubs = catDoc?.subcategories
          .filter(s => s.isVisible !== false)
          .map(s => s.linkName) || [];

        const subcatOr = [
          { subcategoryLink: { $exists: false } },
          { subcategoryLink: null },
          { subcategoryLink: "" }
        ];
        if (visibleSubs.length) subcatOr.push({ subcategoryLink: { $in: visibleSubs } });
        matchBase.$or = subcatOr;
      }
    }

    // 7) Диапазон цен
    let priceRange = null;
    if (typeof cost === "string" && cost.includes(",")) {
      const parts = cost.split(",").map(v => Number(v.trim()));
      if (parts.length === 2 && !parts.some(isNaN)) priceRange = { $gte: parts[0], $lte: parts[1] };
    }

    // 8) Фильтрация по характеристикам
    const andFilters = [];
    const skipKeys = ["search", "brand", "category", "cost", "sort", "page", "limit", "subcategory", "type"];
    for (const [rawKey, rawVal] of Object.entries(otherFilters)) {
      if (!rawVal || skipKeys.includes(rawKey) || rawVal === "undefined") continue;
      const vals = (Array.isArray(rawVal) ? rawVal : rawVal.split(",")).map(v => v.trim()).filter(Boolean);
      if (!vals.length) continue;
      andFilters.push({ characteristics: { $elemMatch: { "key.ru": rawKey, "value.ru": { $in: vals } } } });
    }
    if (andFilters.length) matchBase.$and = andFilters;

    // 9) Стадии вычисления цен
    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: { arr: { $ifNull: ["$variation.variations", []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$arr" }, 0] },
                  { $min: { $map: { input: "$$arr", as: "v", in: "$$v.price" } } },
                  "$retailPrice"
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  {
                    $subtract: [
                      "$basePrice",
                      {
                        $multiply: [
                          "$basePrice",
                          { $divide: [{ $ifNull: ["$discount", 0] }, 100] }
                        ]
                      }
                    ]
                  },
                  2
                ]
              },
              0
            ]
          }
        }
      }
    ];

    // 10) Стадия сортировки
    const sortStage = (() => {
      switch (sortParam) {
        case 'price_asc': return { $sort: { effectivePrice: 1 } };
        case 'price_desc': return { $sort: { effectivePrice: -1 } };
        default: return { $sort: { createdAt: -1 } };
      }
    })();

    // 11) Pipeline для продуктов (без проекции)
    const productPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      sortStage,
      { $skip: skip },
      { $limit: limitNumber }
    ];
    console.log("📦 Product Pipeline:", JSON.stringify(productPipeline, null, 2));

    const products = await Product.aggregate(productPipeline).exec();
    console.log("🔍 First products after sort:", products.slice(0, 5));

    // 12) Подсчет общего количества
    const totalCount = (await Product.aggregate([
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $count: "count" }
    ]).exec())[0]?.count || 0;

    // 13) Построение matchForFacets
    const matchForFacets = { ...matchBase };
    delete matchForFacets.$and;

    // 14) allFacets
    const allFacets = await Product.aggregate([
      { $match: matchForFacets },
      { $unwind: "$characteristics" },
      { $group: { _id: { keyRu: "$characteristics.key.ru", keyUa: "$characteristics.key.ua" } } },
      { $project: { _id: 0, key: { ru: "$_id.keyRu", ua: "$_id.keyUa" } } }
    ]).exec();

    // 15) Facets
    const facets = await Promise.all(allFacets.map(async ({ key }) => {
      const otherGroupFilters = andFilters.filter(f => f.characteristics.$elemMatch['key.ru'] !== key.ru);
      const mf = { ...matchForFacets };
      if (otherGroupFilters.length) mf.$and = otherGroupFilters;
      const options = await Product.aggregate([
        { $match: mf },
        ...priceCalcStages,
        ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
        { $unwind: "$characteristics" },
        { $match: { "characteristics.key.ru": key.ru } },
        { $group: { _id: { valueRu: "$characteristics.value.ru", valueUa: "$characteristics.value.ua", unitRu: "$characteristics.unit.ru", unitUa: "$characteristics.unit.ua" } } },
        { $project: { _id: 0, value: { ru: "$_id.valueRu", ua: "$_id.valueUa" }, unit: { ru: "$_id.unitRu", ua: "$_id.unitUa" } } },
        { $sort: { "value.ru": 1 } }
      ]).exec();
      return { key, options };
    }));

    // 16) Ответ клиенту
    return res.json({ products, count: totalCount, page: pageNumber, totalPages: Math.ceil(totalCount / limitNumber), facets });

  } catch (error) {
    console.error("❌ ERROR in getProductsByCategory:", error);
    return res.status(500).json({ message: "Error", error });
  }
};

// Универсальная функция для RegExp-фильтрации пофигистской к пробелам и регистру
function looseRegexp(str) {
  return new RegExp(
    str
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s*'),
    'i'
  );
}

export const getProducts = async (req, res) => {
  try {
    const {
      search = '',
      brand,
      category,
      subcategory,
      cost,
      inStock,
      isPartner,
      sort = 'default',
      page = '1',
      limit = '10',
      ...otherFilters
    } = req.query;

    console.log(req.query)

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // --- DEBUG START ---
    const debug = (...args) => console.log('\x1b[36m[getProducts]\x1b[0m', ...args);
    debug('NEW REQUEST:', { search, brand, category, subcategory, cost, inStock, isPartner, sort, page, limit, ...otherFilters });

    // 1. Базовый match
    const matchBase = {
      isVisible: true,
      'variations.variations.isVisible': { $ne: false }
    };

    // 2. По наличию
    if (inStock === 'true') {
      matchBase['variations.variations.quantity'] = { $gt: 0 };
      debug('inStock filter:', { 'variations.variations.quantity': { $gt: 0 } });
    }

    // 3. Поиск (manualSearchTags)
    let searchRegexes = [];
    if (search) {
      const terms = search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(t => t.replace(/\s+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(Boolean);
      searchRegexes = terms.map(t => new RegExp(t, 'i'));
      matchBase.manualSearchTags = { $all: searchRegexes };
      debug('manualSearchTags regexes:', searchRegexes);

      // DEBUG: Найдёт ли что-то только по manualSearchTags
      const sample = await Product.findOne({ manualSearchTags: { $all: searchRegexes } });
      debug('Sample product by manualSearchTags:', sample ? { id: sample._id, title: sample.title } : 'NOT FOUND');
    }

    // 4. Brand (brand.brandLink)
    if (brand) {
      const brands = Array.isArray(brand)
        ? brand
        : brand.split(',').map(b => b.trim());
      matchBase['brand.brandLink'] = {
        $in: brands.map(b => looseRegexp(b))
      };
      debug('brand filter:', brands);
    }

    // 5. Категории и подкатегории
    if (
      category &&
      (
        (Array.isArray(category) && category.length > 0 && category[0] !== 'search' && !category[0].startsWith('search,'))
        ||
        (typeof category === 'string' && category !== 'search' && !category.startsWith('search,'))
      )
    ) {
      const link = Array.isArray(category) ? category[0] : category;
      if (subcategory && subcategory !== "undefined" && subcategory !== category) {
        matchBase.subcategoryLink = looseRegexp(subcategory);
        debug('subcategoryLink filter:', subcategory);
      } else {
        matchBase.categoryLink = looseRegexp(link);
        const catDoc = await Category.findOne({ linkName: link }).lean();
        const visibleSubs = catDoc?.subcategories
          .filter(s => s.isVisible !== false)
          .map(s => s.linkName) || [];
        const subcatOr = [
          { subcategoryLink: { $exists: false } },
          { subcategoryLink: null },
          { subcategoryLink: "" }
        ];
        if (visibleSubs.length) {
          subcatOr.push({
            subcategoryLink: { $in: visibleSubs.map(sub => looseRegexp(sub)) }
          });
        }
        matchBase.$or = subcatOr;
        debug('categoryLink:', link, 'visibleSubs:', visibleSubs, 'subcatOr:', subcatOr);
      }
    }

    // 6. Диапазон цен
    let priceRange = null;
    if (typeof cost === 'string' && cost.includes(',')) {
      const [minC, maxC] = cost.split(',').map(v => +v.trim());
      if (!isNaN(minC) && !isNaN(maxC)) {
        priceRange = { $gte: minC, $lte: maxC };
        debug('priceRange:', priceRange);
      }
    }

    // 7. Фильтрация по характеристикам
    const andFilters = [];
    const skipKeys = ['search', 'brand', 'category', 'subcategory', 'cost', 'sort', 'page', 'limit'];
    for (const [key, rawVal] of Object.entries(otherFilters)) {
      if (!rawVal || skipKeys.includes(key) || rawVal === 'undefined') continue;
      const vals = (Array.isArray(rawVal) ? rawVal : rawVal.split(','))
        .map(v => v.trim())
        .filter(Boolean);
      if (!vals.length) continue;
      const regexVals = vals.map(val => looseRegexp(val));
      andFilters.push({
        characteristics: {
          $elemMatch: {
            'key.ru': looseRegexp(key),
            'value.ru': { $in: regexVals }
          }
        }
      });
      debug('characteristics filter:', key, vals);
    }
    if (andFilters.length) {
      matchBase.$and = andFilters;
      debug('$and:', andFilters);
    }

    debug('FINAL matchBase:', JSON.stringify(matchBase, null, 2));

    // 8. isPartner-логика для цен
    const isPartnerBool = String(isPartner).toLowerCase() === "true" || isPartner === 1 || isPartner === "1";
    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: { arr: { $ifNull: ['$variations.variations', []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$arr' }, 0] },
                  {
                    $min: {
                      $map: {
                        input: "$$arr",
                        as: "v",
                        in: isPartnerBool
                          ? { $ifNull: ["$$v.opt_price_uah", "$$v.price"] }
                          : "$$v.price"
                      }
                    }
                  },
                  '$retailPrice'
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  { $subtract: ['$basePrice', { $multiply: ['$basePrice', { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] },
                  2
                ]
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          hasStock: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$variations.variations', []] },
                    as: 'v',
                    cond: { $gt: ['$$v.quantity', 0] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          maxPopular: {
            $let: {
              vars: { arr: { $ifNull: ['$variations.variations', []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$arr' }, 0] },
                  { $max: { $map: { input: '$$arr', as: 'v', in: '$$v.popular' } } },
                  0
                ]
              }
            }
          },
          hasStock: {
            $let: {
              vars: { arr: { $ifNull: ['$variations.variations', []] } },
              in: {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: '$$arr',
                            as: 'v',
                            cond: { $gt: ['$$v.quantity', 0] }
                          }
                        }
                      },
                      0
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      }
    ];

    // 9. Сортировка
    const sortStage = (() => {
      switch (sort) {
        case 'price_asc':
          return { hasStock: -1, basePrice: 1, _id: 1 };
        case 'price_desc':
          return { hasStock: -1, basePrice: -1, _id: 1 };
        case 'popular':
          return { hasStock: -1, maxPopular: -1, _id: 1 };
        default:
          return { hasStock: -1, createdAt: -1, _id: 1 };
      }
    })();

    // 10. Основной pipeline
    const productPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { basePrice: priceRange } }] : []),
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limitNum },
      { $project: { basePrice: 0, effectivePrice: 0 } }
    ];
    debug('productPipeline:', JSON.stringify(productPipeline, null, 2));

    const products = await Product.aggregate(productPipeline).exec();
    debug('products.length:', products.length);

    // 11. Подсчёт количества
    const countAgg = await Product.aggregate([
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { basePrice: priceRange } }] : []),
      { $count: 'count' }
    ]).exec();
    const [{ count = 0 } = {}] = countAgg;
    debug('Total count:', count);

    // 12. Минимальная и максимальная цена
    const minmaxAgg = await Product.aggregate([
      { $match: matchBase },
      ...priceCalcStages,
      { $group: { _id: null, minPrice: { $min: '$basePrice' }, maxPrice: { $max: '$basePrice' } } }
    ]).exec();
    let [{ minPrice = 0, maxPrice = 0 } = {}] = minmaxAgg;
    debug('minPrice:', minPrice, 'maxPrice:', maxPrice);

    // 13. Агрегация всех характеристик для фасетов (групп фильтров)
    const allFacets = await Product.aggregate([
      { $match: matchBase },
      { $unwind: '$characteristics' },
      { $group: { _id: { keyRu: '$characteristics.key.ru', keyUa: '$characteristics.key.ua' } } },
      { $project: { _id: 0, key: { ru: '$_id.keyRu', ua: '$_id.keyUa' } } },
      { $sort: { 'key.ru': 1 } }
    ]).exec();

    // 14. Фасеты: фильтры-опции по всем значениям группы, даже если один уже выбран
    const facets = await Promise.all(
      allFacets.map(async ({ key }) => {
        const mf = { ...matchBase };
        if (mf.$and) {
          mf.$and = mf.$and.filter(f => {
            if (
              f.characteristics &&
              f.characteristics.$elemMatch &&
              f.characteristics.$elemMatch['key.ru']
            ) {
              const el = f.characteristics.$elemMatch['key.ru'];
              if (typeof el === 'object' && el instanceof RegExp) {
                const regStr = el.source.replace(/\\s\*/g, ' ').replace(/\\/g, '');
                return regStr.trim().toLowerCase().replace(/\s+/g, '') !== key.ru.trim().toLowerCase().replace(/\s+/g, '');
              } else if (typeof el === 'string') {
                return el.trim().toLowerCase().replace(/\s+/g, '') !== key.ru.trim().toLowerCase().replace(/\s+/g, '');
              }
            }
            return true;
          });
          if (!mf.$and.length) delete mf.$and;
        }
        const opts = await Product.aggregate([
          { $match: mf },
          ...priceCalcStages,
          ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
          { $unwind: '$characteristics' },
          { $match: { 'characteristics.key.ru': key.ru } },
          { $group: { _id: { valueRu: '$characteristics.value.ru', valueUa: '$characteristics.value.ua', unitRu: '$characteristics.unit.ru', unitUa: '$characteristics.unit.ua' } } },
          { $project: { _id: 0, value: { ru: '$_id.valueRu', ua: '$_id.valueUa' }, unit: { ru: '$_id.unitRu', ua: '$_id.unitUa' } } },
          { $sort: { 'value.ru': 1 } }
        ]).exec();
        return { key, options: opts };
      })
    );

    if (minPrice === maxPrice) {
      maxPrice += 1
    }

    debug('facets.length:', facets.length);

    return res.json({ products, count, page: pageNum, totalPages: Math.ceil(count / limitNum), minPrice, maxPrice, facets });
  } catch (error) {
    console.error('❌ ERROR in getProducts:', error);
    return res.status(500).json({ message: 'Ошибка получения товаров', error });
  }
};






// Получение всех продуктов

// Получение всех продуктов с поиском по названию
// export const getProductsBySearch = async (req, res) => {
//   try {
//     const { search = "" } = req.query;

//     // Проверяем, содержит ли строка последовательность из 5 цифр
//     const isSKU = /\d{5}/.test(search);

//     const query = isSKU
//       ? { sku: { $regex: search, $options: "i" } } // Поиск по SKU (частичное совпадение)
//       : { title: { $regex: `(^|\\s)${search}`, $options: "i" } }; // Поиск по названию

//     const products = await Product.find(query);
//     res.json(products);
//   } catch (error) {
//     res.status(500).json({ message: "Помилка отримання даних", error });
//   }
// };

export const getProductsBySearch = async (req, res) => {
  try {
    console.log("🔍 Received req.query:", JSON.stringify(req.query, null, 2));

    const {
      search = "",
      sort = "default",
      page,      // не задаём дефолт здесь, будем обрабатывать вручную
      limit,     // не задаём дефолт здесь, будем обрабатывать вручную
      cost,
      brand,
      type,       // если указан тип фильтра (например, "category")
      category,   // если type="category", конкретная категория
      ...rawFilters
    } = req.query;

    // Парсим page и limit, и если получилось NaN или <= 0 — ставим дефолт
    let pageNumber = parseInt(page, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      pageNumber = 1;
    }

    let limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber < 1) {
      limitNumber = 10;
    }

    const skip = (pageNumber - 1) * limitNumber;

    // 1. Формируем базовый поисковый фильтр по строке (search)
    const isSKU = /\d{5}/.test(search);
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(isSKU ? search : `(^|\\s)${escaped}`, "i");

    const searchQuery = isSKU
      ? { sku: { $regex: regex } }
      : {
        $or: [
          { "title.ua": { $regex: regex } },
          { "title.ru": { $regex: regex } },
        ],
      };

    // 2. Начальный объект matchBase
    const matchBase = {
      isVisible: true,
      ...searchQuery,
      ...(brand ? { "brand.brandLink": brand } : {}),
    };

    // 3. Если type=category, добавляем фильтр по категории
    if (type === "category" && category) {
      // Здесь предполагаем, что путь к ссылке категории – category.categoryLink
      matchBase["category.categoryLink"] = category;
    }

    // 4. Обработка фильтра по цене (cost) для конечного фильтра по effectivePrice
    let priceRange = null;
    if (cost) {
      const [minP, maxP] = cost
        .split(",")
        .map((v) => Number(v.trim()));
      if (!isNaN(minP) && !isNaN(maxP)) {
        priceRange = { $gte: minP, $lte: maxP };
      }
    }
    console.log("🔧 Price range:", priceRange);

    // 5. Формируем фильтры по характеристикам ($and на основе массива characteristics)
    const andFilters = Object.entries(rawFilters).reduce((acc, [key, raw]) => {
      if (!raw) return acc;
      if (["search", "brand", "type", "category", "cost", "sort", "page", "limit"].includes(key)) {
        return acc;
      }
      const vals = Array.isArray(raw)
        ? raw
        : raw.split(",").map((v) => v.trim());
      const filteredVals = vals.filter((v) => v);

      if (filteredVals.length) {
        acc.push({
          characteristics: {
            $elemMatch: {
              "key.ru": key,
              "value.ru": { $in: filteredVals },
            },
          },
        });
      }
      return acc;
    }, []);

    if (andFilters.length) {
      matchBase.$and = andFilters;
    }

    console.log("🔧 Final matchBase with filters:", JSON.stringify(matchBase, null, 2));

    // 6. Стадии агрегации для вычисления базовой и эффективной цены
    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: {
                arr: { $ifNull: ["$variation.variations", []] },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$arr" }, 0] },
                  { $min: { $map: { input: "$$arr", as: "v", in: "$$v.price" } } },
                  "$cost",
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  {
                    $subtract: [
                      "$basePrice",
                      {
                        $multiply: [
                          "$basePrice",
                          { $divide: [{ $ifNull: ["$discount", 0] }, 100] },
                        ],
                      },
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    // 7. Определяем направление сортировки
    let sortStage = {};
    if (sort === "price_asc") {
      sortStage = { effectivePrice: 1 };
    } else if (sort === "price_desc") {
      sortStage = { effectivePrice: -1 };
    } else {
      // По умолчанию сортируем по дате создания
      sortStage = { createdAt: -1 };
    }

    // 8. Основной pipeline для получения списка товаров
    const productPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limitNumber },
      { $project: { basePrice: 0, effectivePrice: 0 } },
    ];

    console.log(
      "📦 Product aggregation pipeline:",
      JSON.stringify(productPipeline, null, 2)
    );

    const products = await Product.aggregate(productPipeline).exec();

    // 9. Pipeline для подсчёта общего количества товаров
    const countPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $count: "count" },
    ];

    const cntRes = await Product.aggregate(countPipeline).exec();
    const totalCount = cntRes[0]?.count || 0;
    console.log(`🔢 Total matched products count: ${totalCount}`);

    // 10. Pipeline для получения минимальной и максимальной цен (для слайдера фильтра)
    const minMaxPricePipeline = [
      { $match: { isVisible: true, ...(brand ? { "brand.brandLink": brand } : {}) } },
      ...priceCalcStages,
      {
        $group: {
          _id: null,
          minPrice: { $min: "$effectivePrice" },
          maxPrice: { $max: "$effectivePrice" },
        },
      },
    ];

    const minMaxRes = await Product.aggregate(minMaxPricePipeline).exec();
    const minPrice = minMaxRes[0]?.minPrice ?? 0;
    const maxPrice = minMaxRes[0]?.maxPrice ?? 0;
    console.log(`🔧 minPrice=${minPrice}, maxPrice=${maxPrice}`);

    // 11. Получаем все уникальные ключи характеристик, доступные для текущего matchBase
    const characteristicKeys = await Product.distinct("characteristics.key.ru", matchBase);
    console.log("🔑 Distinct characteristic keys:", characteristicKeys);

    // 12. Формируем фасетные пайплайны для каждого ключа характеристик
    const facetPipelines = characteristicKeys.reduce((acc, key) => {
      const fMatch = { ...matchBase };
      if (fMatch.$and) {
        const newAnd = fMatch.$and.filter((filter) => {
          const k = filter.characteristics?.$elemMatch["key.ru"];
          return k !== key;
        });
        if (newAnd.length) {
          fMatch.$and = newAnd;
        } else {
          delete fMatch.$and;
        }
      }

      const singleFacetPipeline = [
        { $match: fMatch },
        ...priceCalcStages,
        ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
        { $unwind: "$characteristics" },
        { $match: { "characteristics.key.ru": key } },
        {
          $group: {
            _id: "$characteristics.value.ru",
            count: { $sum: 1 },
            unit: { $first: "$characteristics.unit.ru" },
          },
        },
        { $project: { _id: 0, value: "$_id", unit: 1, count: 1 } },
        { $sort: { count: -1, value: 1 } },
      ];

      acc[key] = singleFacetPipeline;
      return acc;
    }, {});

    console.log("📐 Facet pipelines generated");

    let facetsAgg = {};
    if (Object.keys(facetPipelines).length) {
      const [facetResult] = await Product.aggregate([{ $facet: facetPipelines }]).exec();
      facetsAgg = facetResult;
      console.log(
        "📊 Facets aggregation result:",
        JSON.stringify(facetsAgg, null, 2)
      );
    }

    // 13. Отправляем ответ
    return res.json({
      products,
      count: totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / limitNumber),
      minPrice,
      maxPrice,
      facets: facetsAgg,
    });
  } catch (error) {
    console.error("❌ ERROR in getProductsBySearch:", error);
    return res.status(500).json({ message: "Помилка отримання даних", error });
  }
};


export const getProductsByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ message: "Не вказано тип продукту" });
    }

    const products = await Product.find({
      "variations.variations.type": type
    });

    res.json(products);
  } catch (err) {
    console.error("Error fetching products by type:", err);
    res.status(500).json({ message: err.message });
  }
};


export const getProductsByBrand = async (req, res) => {
  try {
    console.log("DEBUG: Received req.query:", JSON.stringify(req.query, null, 2));

    const {
      sort = "default",
      page = "1",
      limit = "12",
      brand,
      cost,
      type,
      category,
      ...otherFilters
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));
    const skip = (pageNumber - 1) * limitNumber;

    const matchBase = { isVisible: true };
    if (brand) {
      matchBase["brand.brandLink"] = brand;
    }
    if (type === "category" && category) {
      matchBase["categoryLink"] = category;
    }

    const andFilters = Object.entries(otherFilters).reduce((acc, [rawKey, rawVal]) => {
      if (!rawVal) return acc;
      if (["sort", "page", "limit", "cost", "brand", "type", "category"].includes(rawKey)) {
        return acc;
      }

      const vals = Array.isArray(rawVal)
        ? rawVal
        : String(rawVal)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

      if (!vals.length) return acc;

      const isEnglishKey = /^[A-Za-z0-9]+$/.test(rawKey);
      const keyField = isEnglishKey ? "key.ru" : "key.ua";
      const valueField = isEnglishKey ? "value.ru" : "value.ua";

      acc.push({
        characteristics: {
          $elemMatch: {
            [keyField]: rawKey,
            [valueField]: { $in: vals },
          },
        },
      });
      return acc;
    }, []);

    if (andFilters.length) {
      matchBase.$and = andFilters;
    }

    console.log("DEBUG: Final matchBase with filters:", JSON.stringify(matchBase, null, 2));

    let priceRange = null;
    if (cost) {
      const [minP, maxP] = cost.split(",").map((v) => Number(v.trim()));
      if (!isNaN(minP) && !isNaN(maxP)) {
        priceRange = { $gte: minP, $lte: maxP };
      }
    }
    console.log("DEBUG: Price range:", priceRange);

    const sortDir = sort === "price_desc" ? -1 : 1;

    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: { arr: { $ifNull: ["$variation.variations", []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$arr" }, 0] },
                  { $min: { $map: { input: "$$arr", as: "v", in: "$$v.price" } } },
                  "$cost",
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  {
                    $subtract: [
                      "$basePrice",
                      {
                        $multiply: [
                          "$basePrice",
                          { $divide: [{ $ifNull: ["$discount", 0] }, 100] },
                        ],
                      },
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    const productPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $sort: { effectivePrice: sortDir } },
      { $skip: skip },
      { $limit: limitNumber },
      { $project: { basePrice: 0, effectivePrice: 0 } },
    ];
    console.log("DEBUG: Product aggregation pipeline:", JSON.stringify(productPipeline, null, 2));
    const products = await Product.aggregate(productPipeline).exec();

    const countPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $count: "count" },
    ];
    const cntRes = await Product.aggregate(countPipeline).exec();
    const totalCount = cntRes[0]?.count || 0;
    console.log(`DEBUG: Total matched products count: ${totalCount}`);

    const minMaxPricePipeline = [
      {
        $match: {
          isVisible: true,
          ...(brand ? { "brand.brandLink": brand } : {}),
          ...(type === "category" && category ? { categoryLink: category } : {}),
        },
      },
      ...priceCalcStages,
      {
        $group: {
          _id: null,
          minPrice: { $min: "$effectivePrice" },
          maxPrice: { $max: "$effectivePrice" },
        },
      },
    ];
    const minMaxRes = await Product.aggregate(minMaxPricePipeline).exec();
    const minPrice = minMaxRes[0]?.minPrice ?? 0;
    const maxPrice = minMaxRes[0]?.maxPrice ?? 0;
    console.log(`DEBUG: minPrice=${minPrice}, maxPrice=${maxPrice}`);

    const keyPairs = await Product.aggregate([
      { $match: matchBase },
      { $unwind: "$characteristics" },
      {
        $group: {
          _id: {
            keyUk: "$characteristics.key.ua",
            keyEn: "$characteristics.key.ru",
          },
        },
      },
    ]);

    const validKeyPairs = keyPairs.filter(
      ({ _id: { keyEn } }) => typeof keyEn === "string" && keyEn.trim() !== ""
    );

    const facetPipelines = {};
    validKeyPairs.forEach(({ _id: { keyUk, keyEn } }) => {
      const fMatch = { ...matchBase };
      if (fMatch.$and) {
        const newAnd = fMatch.$and.filter((filter) => {
          const em = filter.characteristics?.$elemMatch;
          return em?.["key.ru"] !== keyEn;
        });
        if (newAnd.length) {
          fMatch.$and = newAnd;
        } else {
          delete fMatch.$and;
        }
      }
      facetPipelines[keyEn] = [
        { $match: fMatch },
        ...priceCalcStages,
        ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
        { $unwind: "$characteristics" },
        { $match: { "characteristics.key.ru": keyEn } },
        {
          $group: {
            _id: {
              valUk: "$characteristics.value.ua",
              valEn: "$characteristics.value.ru",
              unitUk: "$characteristics.unit.ua",
              unitEn: "$characteristics.unit.ru",
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            value: { uk: "$_id.valUk", en: "$_id.valEn" },
            unit: { uk: "$_id.unitUk", en: "$_id.unitEn" },
            count: 1,
          },
        },
        { $sort: { count: -1, "value.ru": 1 } },
      ];
    });

    let facetsAgg = [];
    if (Object.keys(facetPipelines).length) {
      const [rawFacets] = await Product.aggregate([{ $facet: facetPipelines }]).exec();
      facetsAgg = validKeyPairs.map(({ _id: { keyUk, keyEn } }) => ({
        key: { uk: keyUk, en: keyEn },
        options: rawFacets[keyEn] || [],
      }));
    }

    console.log("DEBUG: Facets aggregation result:", JSON.stringify(facetsAgg, null, 2));

    return res.json({
      products,
      count: totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / limitNumber),
      minPrice,
      maxPrice,
      facets: facetsAgg,
    });
  } catch (err) {
    console.error("getProductsByBrand ERROR:", err);
    return res.status(500).json({ error: "Ошибка при получении товаров по бренду" });
  }
};

export const getNewProducts = async (req, res) => {
  try {
    console.log("DEBUG: Received req.query for new products:", JSON.stringify(req.query, null, 2));

    const {
      sort = "default",
      page = "1",
      limit = "12",
      type,
      category,
      cost,
      ...otherFilters
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));
    const skip = (pageNumber - 1) * limitNumber;

    const matchBase = { isVisible: true, isNew: true };
    if (type === "category" && category) {
      matchBase["categoryLink"] = category;
    }

    const andFilters = Object.entries(otherFilters).reduce((acc, [rawKey, rawVal]) => {
      if (!rawVal) return acc;
      if (["sort", "page", "limit", "cost", "type", "category"].includes(rawKey)) return acc;

      const vals = Array.isArray(rawVal)
        ? rawVal
        : String(rawVal).split(",").map((v) => v.trim()).filter(Boolean);

      if (!vals.length) return acc;

      const isEnglishKey = /^[A-Za-z0-9]+$/.test(rawKey);
      const keyField = isEnglishKey ? "key.ru" : "key.ua";
      const valueField = isEnglishKey ? "value.ru" : "value.ua";

      acc.push({
        characteristics: {
          $elemMatch: {
            [keyField]: rawKey,
            [valueField]: { $in: vals },
          },
        },
      });

      return acc;
    }, []);

    if (andFilters.length) {
      matchBase.$and = andFilters;
    }

    console.log("DEBUG: Final matchBase for new products:", JSON.stringify(matchBase, null, 2));

    let priceRange = null;
    if (cost) {
      const [minP, maxP] = cost.split(",").map((v) => Number(v.trim()));
      if (!isNaN(minP) && !isNaN(maxP)) {
        priceRange = { $gte: minP, $lte: maxP };
      }
    }

    console.log("DEBUG: Price range for new products:", priceRange);

    const sortDir = sort === "price_desc" ? -1 : 1;

    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: { arr: { $ifNull: ["$variation.variations", []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$arr" }, 0] },
                  {
                    $min: {
                      $map: {
                        input: "$$arr",
                        as: "v",
                        in: "$$v.price",
                      },
                    },
                  },
                  "$cost",
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  {
                    $subtract: [
                      "$basePrice",
                      {
                        $multiply: [
                          "$basePrice",
                          { $divide: [{ $ifNull: ["$discount", 0] }, 100] },
                        ],
                      },
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    const productPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $sort: { effectivePrice: sortDir } },
      { $skip: skip },
      { $limit: limitNumber },
      { $project: { basePrice: 0, effectivePrice: 0 } },
    ];

    console.log("DEBUG: Product aggregation pipeline for new products:", JSON.stringify(productPipeline, null, 2));
    const products = await Product.aggregate(productPipeline).exec();

    const countPipeline = [
      { $match: matchBase },
      ...priceCalcStages,
      ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
      { $count: "count" },
    ];
    const cntRes = await Product.aggregate(countPipeline).exec();
    const totalCount = cntRes[0]?.count || 0;
    console.log(`DEBUG: Total matched new products count: ${totalCount}`);

    const minMaxPricePipeline = [
      {
        $match: {
          isVisible: true,
          isNew: true,
          ...(type === "category" && category ? { categoryLink: category } : {}),
        },
      },
      ...priceCalcStages,
      {
        $group: {
          _id: null,
          minPrice: { $min: "$effectivePrice" },
          maxPrice: { $max: "$effectivePrice" },
        },
      },
    ];
    const minMaxRes = await Product.aggregate(minMaxPricePipeline).exec();
    const minPrice = minMaxRes[0]?.minPrice ?? 0;
    const maxPrice = minMaxRes[0]?.maxPrice ?? 0;
    console.log(`DEBUG: minPrice=${minPrice}, maxPrice=${maxPrice} for new products`);

    const keyPairs = await Product.aggregate([
      { $match: matchBase },
      { $unwind: "$characteristics" },
      {
        $group: {
          _id: {
            keyUk: "$characteristics.key.ua",
            keyEn: "$characteristics.key.ru",
          },
        },
      },
    ]);

    const validKeyPairs = keyPairs.filter(
      ({ _id: { keyEn } }) => typeof keyEn === "string" && keyEn.trim() !== ""
    );

    const facetPipelines = {};
    validKeyPairs.forEach(({ _id: { keyUk, keyEn } }) => {
      const fMatch = { ...matchBase };
      if (fMatch.$and) {
        const newAnd = fMatch.$and.filter((filter) => {
          const em = filter.characteristics?.$elemMatch;
          return em?.["key.ru"] !== keyEn;
        });
        if (newAnd.length) {
          fMatch.$and = newAnd;
        } else {
          delete fMatch.$and;
        }
      }

      facetPipelines[keyEn] = [
        { $match: fMatch },
        ...priceCalcStages,
        ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
        { $unwind: "$characteristics" },
        { $match: { "characteristics.key.ru": keyEn } },
        {
          $group: {
            _id: {
              valUk: "$characteristics.value.ua",
              valEn: "$characteristics.value.ru",
              unitUk: "$characteristics.unit.ua",
              unitEn: "$characteristics.unit.ru",
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            value: { uk: "$_id.valUk", en: "$_id.valEn" },
            unit: { uk: "$_id.unitUk", en: "$_id.unitEn" },
            count: 1,
          },
        },
        { $sort: { count: -1, "value.ru": 1 } },
      ];
    });

    let facetsAgg = [];
    if (Object.keys(facetPipelines).length) {
      const [rawFacets] = await Product.aggregate([{ $facet: facetPipelines }]).exec();
      facetsAgg = validKeyPairs.map(({ _id: { keyUk, keyEn } }) => ({
        key: { uk: keyUk, en: keyEn },
        options: rawFacets[keyEn] || [],
      }));
    }

    console.log("DEBUG: Facets aggregation for new products:", JSON.stringify(facetsAgg, null, 2));

    return res.json({
      products,
      count: totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / limitNumber),
      minPrice,
      maxPrice,
      facets: facetsAgg,
    });
  } catch (err) {
    console.error("getNewProducts ERROR:", err);
    return res.status(500).json({ error: "Ошибка при получении новинок" });
  }
};




export const getAllProducts = async (req, res) => {
  try {
    console.log("\n===== START getAllProducts =====");
    console.log("🔍 Received req.query:", JSON.stringify(req.query, null, 2));

    const {
      sort = "",    // 'price_asc' или 'price_desc'
      page = "1",
      limit = "10",
      cost,
      brand,
      category,
      ...otherFilters
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));
    const skip = (pageNumber - 1) * limitNumber;

    // 1) Формируем базовый match
    const matchBase = { isVisible: true };

    // если category === "all", пропускаем фильтрацию по categoryLink
    if (category && category !== "all") {
      matchBase["categoryLink"] = category;
    }

    if (brand) {
      if (typeof brand === "string" && brand.includes(",")) {
        matchBase["brand.brandLink"] = { $in: brand.split(",").map((b) => b.trim()) };
      } else if (Array.isArray(brand)) {
        matchBase["brand.brandLink"] = { $in: brand };
      } else {
        matchBase["brand.brandLink"] = brand;
      }
    }

    // 2) Фильтрация по характеристикам (otherFilters) с поддержкой en/uk
    const andFilters = Object.entries(otherFilters).reduce((acc, [rawKey, rawVal]) => {
      if (!rawVal) return acc;
      // Пропускаем системные поля
      if (["sort", "page", "limit", "cost", "brand", "category"].includes(rawKey)) {
        return acc;
      }

      const vals = Array.isArray(rawVal)
        ? rawVal
        : String(rawVal)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

      if (!vals.length) return acc;

      // Определяем, на каком языке пришёл ключ: латиница/цифры → en, иначе → uk
      const isEnglishKey = /^[A-Za-z0-9]+$/.test(rawKey);
      const keyField = isEnglishKey ? "key.ru" : "key.ua";
      const valueField = isEnglishKey ? "value.ru" : "value.ua";

      acc.push({
        characteristics: {
          $elemMatch: {
            [keyField]: rawKey,
            [valueField]: { $in: vals },
          },
        },
      });
      return acc;
    }, []);

    if (andFilters.length) {
      matchBase.$and = andFilters;
    }

    console.log("🔨 Final match stage:", JSON.stringify(matchBase, null, 2));

    // 3) Диапазон цены по effectivePrice
    let priceRange = null;
    if (cost) {
      const priceArray = typeof cost === "string"
        ? cost.split(",").map((v) => Number(v.trim()))
        : cost.map(Number);
      if (priceArray.length === 2 && !priceArray.some(isNaN)) {
        priceRange = { $gte: priceArray[0], $lte: priceArray[1] };
      }
    }
    console.log("🔨 Price range:", priceRange);

    // 4) Этапы вычисления basePrice и effectivePrice
    const priceCalcStages = [
      {
        $addFields: {
          basePrice: {
            $let: {
              vars: { arr: { $ifNull: ["$variation.variations", []] } },
              in: {
                $cond: [
                  { $gt: [{ $size: "$$arr" }, 0] },
                  { $min: { $map: { input: "$$arr", as: "v", in: "$$v.price" } } },
                  "$cost",
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          effectivePrice: {
            $max: [
              {
                $round: [
                  {
                    $subtract: [
                      "$basePrice",
                      {
                        $multiply: [
                          "$basePrice",
                          { $divide: [{ $ifNull: ["$discount", 0] }, 100] },
                        ],
                      },
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
    ];

    // 5) Собираем основной pipeline для выдачи продуктов
    const pipeline = [{ $match: matchBase }, ...priceCalcStages];

    if (priceRange) {
      pipeline.push({ $match: { effectivePrice: priceRange } });
    }

    // Сортировка
    if (sort === "price_asc") {
      pipeline.push({ $sort: { effectivePrice: 1 } });
      console.log("🔨 Added $sort by effectivePrice asc");
    } else if (sort === "price_desc") {
      pipeline.push({ $sort: { effectivePrice: -1 } });
      console.log("🔨 Added $sort by effectivePrice desc");
    }

    // Пагинация
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNumber });
    console.log("🔨 Added $skip and $limit for pagination");

    console.log("▶️ Executing aggregation pipeline:", JSON.stringify(pipeline, null, 2));
    const products = await Product.aggregate(pipeline);

    console.log(`✅ Fetched products count: ${products.length}`);

    // 6) Подсчёт общего количества товаров (без пагинации)
    const countPipeline = [{ $match: matchBase }, ...priceCalcStages];
    if (priceRange) {
      countPipeline.push({ $match: { effectivePrice: priceRange } });
    }
    countPipeline.push({ $count: "count" });

    const countRes = await Product.aggregate(countPipeline);
    const totalCount = countRes[0]?.count || 0;

    console.log("🔢 Total count:", totalCount);

    // 7) minPrice/maxPrice для слайдера (игнорируем характеристики)
    const minMaxPricePipeline = [
      {
        $match: {
          isVisible: true,
          ...(brand ? { "brand.brandLink": brand } : {}),
          ...(category && category !== "all" ? { categoryLink: category } : {}),
        },
      },
      ...priceCalcStages,
      {
        $group: {
          _id: null,
          minPrice: { $min: "$effectivePrice" },
          maxPrice: { $max: "$effectivePrice" },
        },
      },
    ];
    const minMaxRes = await Product.aggregate(minMaxPricePipeline);
    const minPrice = minMaxRes[0]?.minPrice ?? 0;
    const maxPrice = minMaxRes[0]?.maxPrice ?? 0;
    console.log(`🔧 minPrice=${minPrice}, maxPrice=${maxPrice}`);

    // 8) Динамическая фасетная агрегация
    // 8.a) Собираем список distinct ключей {keyUk, keyEn} для текущего matchBase
    const keyPairs = await Product.aggregate([
      { $match: matchBase },
      { $unwind: "$characteristics" },
      {
        $group: {
          _id: {
            keyUk: "$characteristics.key.ua",
            keyEn: "$characteristics.key.ru",
          },
        },
      },
    ]);

    // 8.b) Фильтруем пары, убирая пустые keyEn
    const validKeyPairs = keyPairs.filter(
      ({ _id: { keyEn } }) => typeof keyEn === "string" && keyEn.trim() !== ""
    );

    // 8.c) Для каждого ключа строим свой pipeline, исключая фильтр по этому ключу
    const facetPipelines = {};
    validKeyPairs.forEach(({ _id: { keyUk, keyEn } }) => {
      const fMatch = { ...matchBase };
      if (fMatch.$and) {
        const newAnd = fMatch.$and.filter((filter) => {
          const em = filter.characteristics?.$elemMatch;
          return em?.["key.ru"] !== keyEn;
        });
        if (newAnd.length) {
          fMatch.$and = newAnd;
        } else {
          delete fMatch.$and;
        }
      }

      facetPipelines[keyEn] = [
        { $match: fMatch },
        ...priceCalcStages,
        ...(priceRange ? [{ $match: { effectivePrice: priceRange } }] : []),
        { $unwind: "$characteristics" },
        { $match: { "characteristics.key.ru": keyEn } },
        {
          $group: {
            _id: {
              valUk: "$characteristics.value.ua",
              valEn: "$characteristics.value.ru",
              unitUk: "$characteristics.unit.ua",
              unitEn: "$characteristics.unit.ru",
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            value: { uk: "$_id.valUk", en: "$_id.valEn" },
            unit: { uk: "$_id.unitUk", en: "$_id.unitEn" },
            count: 1,
          },
        },
        { $sort: { count: -1, "value.ru": 1 } },
      ];
    });

    let facetsAgg = [];
    if (Object.keys(facetPipelines).length) {
      const [rawFacets] = await Product.aggregate([{ $facet: facetPipelines }]);
      facetsAgg = validKeyPairs.map(({ _id: { keyUk, keyEn } }) => ({
        key: { uk: keyUk, en: keyEn },
        options: rawFacets[keyEn] || [],
      }));
    }

    console.log("📊 Facet aggregation result:", JSON.stringify(facetsAgg, null, 2));
    console.log("===== END getAllProducts =====\n");

    // 9) Отправляем ответ клиенту
    res.json({
      products,
      count: totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / limitNumber),
      minPrice,
      maxPrice,
      facets: facetsAgg,
    });
  } catch (err) {
    console.error("❌ ERROR in getAllProducts:", err);
    res.status(500).json({ message: "Ошибка получения данных", error: err });
  }
};



export const getAllProductsForm = async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ products });
  } catch (error) {
    console.error("ERROR: Помилка отримання всіх товарів:", error);
    res.status(500).json({ message: "Помилка отримання товарів", error });
  }
};
