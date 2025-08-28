import Product from "../../models/Product.js";
import Settings from "../../models/admin/Settings.js";
import {
  parseJsonFields,
  saveFiles,
  variationConfig,
} from "../../utils/baseController.js";
import slugify from "slugify";
import connectDB from "../../config/db.js";
import Counter from "../../models/Counter.js";

import path from "path";
import fs from "fs";

// Получить все товары
export const getAllProducts = async (
  req,
  res
) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};

// Получить товар по id (поле id в схеме)
export const getProductById = async (
  req,
  res
) => {
  try {
    const product = await Product.findOne({
      id: req.params.id,
    });
    if (!product)
      return res
        .status(404)
        .json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};

// Создать новый товар
// export const createProduct = async (req, res) => {
//   const product = new Product(req.body);
//   try {
//     const newProduct = await product.save();
//     res.status(201).json(newProduct);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// };

const getImageForApplication = (name) => {
  const mapping = {
    Безглютенові: "/images/gluten-free.png",
    "Без цукру": "/images/sugar-free.png",
    "Без лактози": "/images/lactose-free.png",
    "Без яєць": "/images/egg-free.png",
    Ферментоване: "/images/fermented.png",
  };
  return mapping[name] || "";
};

// Вспомогательная функция для безопасного парсинга JSON-строк

const safeParse = (value, defaultValue = []) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  // ★ Если value уже не строка (например, массив или объект), возвращаем его напрямую:
  if (value != null) return value;
  return defaultValue;
};

// === Функция генерации уникального числового ID (100000–999999) ===
async function generateUniqueProductId() {
  let unique = false;
  let generatedId = null;

  while (!unique) {
    generatedId = Math.floor(
      100000 + Math.random() * 900000
    ); // Пример: 743291
    const existing = await Product.findOne({
      id: generatedId,
    });
    if (!existing) unique = true;
  }

  return generatedId;
}

// Вспомогательная функция для безопасного парсинга JSON
const safeJSONParse = (
  str,
  defaultValue = []
) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error("JSON parse error:", err);
    return defaultValue;
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      production,
      productionLink,
      title,
      titleLink,
      category,
      categoryLink,
      subcategory,
      subcategoryLink,
      brand,
      packing,
      shelfTime,
      type,
      types,
      description,
      features,
      neededs,
      components, // Новое поле
      added,
      characteristics,
      application,
      delivery,
      isNew: rawIsNew,
      sku,
      quantity: rawQuantity,
      discount: rawDiscount,
      cost: rawCost,
      multiplicity: rawMultiplicity,
      costEUR: rawCostEUR,
      // возможно другие поля...
    } = req.body;

    // 1. Парсинг мультиязычных полей (production, title, category, subcategory, brand и т.п.)
    const parsedProduction =
      typeof production === "string"
        ? safeParse(production, {
            uk: "",
            en: "",
          })
        : production || { uk: "", en: "" };

    const parsedTitle =
      typeof title === "string"
        ? safeParse(title, { uk: "", en: "" })
        : title || { uk: "", en: "" };

    const parsedCategory =
      typeof category === "string"
        ? safeParse(category, { uk: "", en: "" })
        : category || { uk: "", en: "" };

    const parsedSubcategory =
      typeof subcategory === "string"
        ? safeParse(subcategory, {
            uk: "",
            en: "",
          })
        : subcategory || { uk: "", en: "" };

    const parsedBrand =
      typeof brand === "string"
        ? safeParse(brand, {
            name: { uk: "", en: "" },
            brandLink: "",
          })
        : brand || {
            name: { uk: "", en: "" },
            brandLink: "",
          };

    const parsedDescription =
      typeof description === "string"
        ? safeParse(description, {
            uk: "",
            en: "",
          })
        : description || { uk: "", en: "" };

    const parsedNeededs =
      typeof neededs === "string"
        ? safeParse(neededs, { uk: "", en: "" })
        : neededs || { uk: "", en: "" };

    const parsedAdded =
      typeof added === "string"
        ? safeParse(added, { uk: "", en: "" })
        : added || { uk: "", en: "" };

    // 2. Парсим features, composition, application по вашему коду
    const parsedFeatures = (() => {
      if (typeof features === "string")
        return safeParse(features, []);
      if (Array.isArray(features))
        return features;
      return [];
    })();

    const parsedComposition = (() => {
      if (
        typeof req.body.composition === "string"
      ) {
        return safeParse(
          req.body.composition,
          []
        );
      }
      if (Array.isArray(req.body.composition)) {
        return req.body.composition;
      }
      return [];
    })();

    const parsedApplication = (() => {
      if (typeof application === "string")
        return safeParse(application, []);
      if (Array.isArray(application)) {
        return application.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            item.name &&
            item.image
          ) {
            return {
              name: item.name,
              image: item.image,
            };
          }
          return {
            name: item,
            image: getImageForApplication(item),
          };
        });
      }
      return [];
    })();

    // 3. Парсим characteristics (массив объектов)
    const parsedCharacteristicsObj = (() => {
      if (typeof characteristics === "string") {
        try {
          return JSON.parse(characteristics);
        } catch {
          return { type: [], default: [] };
        }
      } else if (
        typeof characteristics === "object" &&
        characteristics !== null
      ) {
        return characteristics;
      }
      return { type: [], default: [] };
    })();

    const parsedCharacteristicsArray =
      Array.isArray(parsedCharacteristicsObj.type)
        ? parsedCharacteristicsObj.type.map(
            (item) => ({
              key: item.key,
              value: item.value,
              unit: item.unit,
            })
          )
        : [];

    // 4. Парсим delivery (объект с полем self_pickup)
    let rawDelivery = {};
    if (delivery) {
      if (typeof delivery === "string") {
        try {
          rawDelivery = JSON.parse(delivery);
        } catch {
          rawDelivery = {};
        }
      } else if (typeof delivery === "object") {
        rawDelivery = delivery;
      }
    }
    const parsedDelivery = {
      self_pickup:
        rawDelivery.self_pickup === true ||
        rawDelivery.self_pickup === "true",
    };

    // 5. Парсим imageURL (либо через файлы, либо через строку/массив)
    let parsedImageURL = [];
    if (
      req.files &&
      Array.isArray(req.files) &&
      req.files.length > 0
    ) {
      parsedImageURL = req.files.map(
        (f) =>
          `http:// 192.168.0.106:5002/uploads/${f.filename}`
      );
    } else {
      if (typeof req.body.imageURL === "string") {
        parsedImageURL = safeParse(
          req.body.imageURL,
          []
        );
      } else if (
        Array.isArray(req.body.imageURL)
      ) {
        parsedImageURL = req.body.imageURL;
      }
    }

    // 6. Валютный курс и пересчёт cost
    const setting = await Settings.findOne({
      key: "exchangeRate",
    });
    const rate = setting ? setting.value : 45;
    const costEurNumber =
      rawCostEUR != null
        ? Number(rawCostEUR)
        : null;
    const parsedCost =
      costEurNumber !== null &&
      !isNaN(costEurNumber)
        ? Math.round(costEurNumber * rate)
        : Number(rawCost || 0);

    // 7. Уникальный ID товара
    const generatedId =
      await generateUniqueProductId();

    // 8. Булево поле isNew
    const isNew =
      rawIsNew === "true" || rawIsNew === true;

    // 9. Числовые поля quantity, discount, multiplicity
    const quantity =
      rawQuantity != null
        ? Number(rawQuantity)
        : 0;
    const discount =
      rawDiscount != null
        ? Number(rawDiscount)
        : 0;
    const multiplicity =
      rawMultiplicity != null
        ? Number(rawMultiplicity)
        : 0;

    // 10. Парсим новый динамический components:
    // Возможные варианты:
    // - components: JSON-строка с { columns: [...], rows: [...] }
    // - components: уже объект с такой структурой
    // - components: старый формат: массив объектов { uk, en }
    // - components: отсутствует или некорректный формат

    let parsedComponents;
    // Сначала попытка получить rawComponents как объект/массив
    let rawComponents;
    if (typeof components === "string") {
      try {
        rawComponents = JSON.parse(components);
      } catch {
        rawComponents = null;
      }
    } else if (
      typeof components === "object" &&
      components !== null
    ) {
      rawComponents = components;
    } else {
      rawComponents = null;
    }

    // Функция для трансформации старого формата массива {uk,en} в новый
    const transformOldComponents = (oldArr) => {
      // oldArr: [{ uk: "...", en: "..." }, ...]
      const defaultKey = "component";
      const columns = [
        {
          key: defaultKey,
          label: {
            uk: "Компонент",
            en: "Component",
          },
        },
      ];
      const rows = oldArr.map((item) => ({
        values: {
          [defaultKey]: {
            uk: item.uk || "",
            en: item.en || "",
          },
        },
      }));
      return { columns, rows };
    };

    if (
      rawComponents &&
      typeof rawComponents === "object" &&
      Array.isArray(rawComponents.columns) &&
      Array.isArray(rawComponents.rows)
    ) {
      // Уже в новом формате
      parsedComponents = rawComponents;
    } else if (
      Array.isArray(rawComponents) &&
      rawComponents.length > 0 &&
      rawComponents.every(
        (item) =>
          item &&
          typeof item === "object" &&
          ("uk" in item || "en" in item)
      )
    ) {
      // Старый формат: массив многоязычных строк
      parsedComponents = transformOldComponents(
        rawComponents
      );
    } else {
      // Ничего разумного не пришло — ставим пустую структуру
      parsedComponents = {
        columns: [],
        rows: [],
      };
    }

    // 11. Собираем объект для создания
    const productData = {
      id: generatedId,
      production: parsedProduction,
      productionLink: productionLink || "",
      title: parsedTitle,
      titleLink: titleLink || "",
      category: parsedCategory,
      categoryLink: categoryLink || "",
      subcategory: parsedSubcategory,
      subcategoryLink: subcategoryLink || "",
      type: type || "",
      types: types || "",
      brand: parsedBrand,
      packing: packing || "",
      shelfTime: shelfTime || "",
      description: parsedDescription,
      features: parsedFeatures,
      neededs: parsedNeededs,
      components: parsedComponents, // <-- новая мультиязычная динамическая структура
      added: parsedAdded,
      characteristics: parsedCharacteristicsArray,
      application: parsedApplication,
      composition: parsedComposition,
      variation: {
        name: "",
        variations: [],
      },
      imageURL: parsedImageURL,
      cost: parsedCost,
      sku: sku || "",
      quantity: quantity,
      discount: discount,
      multiplicity: multiplicity,
      isNew: isNew,
      delivery: parsedDelivery,
    };

    // 12. Вычисляем computedPrice исходя из discount и вариаций, если нужно
    let basePrice = productData.cost;
    if (
      productData.variation &&
      Array.isArray(
        productData.variation.variations
      ) &&
      productData.variation.variations.length > 0
    ) {
      basePrice =
        Number(
          productData.variation.variations[0]
            .price
        ) || basePrice;
    }
    productData.computedPrice = Math.round(
      basePrice -
        (basePrice * productData.discount) / 100
    );

    // 13. Сохраняем новый продукт
    const product = new Product(productData);
    const newProduct = await product.save();
    return res.status(201).json(newProduct);
  } catch (err) {
    console.error(
      "Ошибка при создании товара:",
      err
    );
    return res
      .status(400)
      .json({ message: err.message });
  }
};

// ------------------------ UPDATE ------------------------
const transformOldComponents = (oldArr) => {
  const defaultKey = "component";
  return {
    columns: [
      {
        key: defaultKey,
        label: {
          uk: "Компонент",
          en: "Component",
        },
      },
    ],
    rows: oldArr.map((item) => ({
      values: {
        [defaultKey]: {
          uk: item.uk || "",
          en: item.en || "",
        },
      },
    })),
  };
};

export const updateProduct = async (req, res) => {
  try {
    // 1. Извлекаем простые поля из req.body
    const {
      sku: rawSku,
      multiplicity: rawMultiplicity,
      quantity: rawQuantity,
      discount: rawDiscount,
      cost: rawCost,
      costEUR: rawCostEUR,
      isNew: rawIsNew,
    } = req.body;

    // 2. Парсим imageURL
    const imageURLs = Array.isArray(
      req.body.imageURL
    )
      ? req.body.imageURL
      : typeof req.body.imageURL === "string"
      ? safeJSONParse(req.body.imageURL, [])
      : [];

    // 3. Парсим application
    let apps = [];
    if (req.body.application) {
      apps = safeJSONParse(
        req.body.application,
        []
      );
      if (!Array.isArray(apps)) {
        apps = Array.isArray(req.body.application)
          ? req.body.application
          : [req.body.application];
      }
    }
    const application = apps.map((item) => {
      if (
        item &&
        typeof item === "object" &&
        item.name
      )
        return item;
      return {
        name: item,
        image: getImageForApplication(item),
      };
    });

    // 4. Парсим composition
    const composition = req.body.composition
      ? safeJSONParse(req.body.composition, [])
      : [];

    // 5. Парсим мультиязычные поля
    const production = req.body.production
      ? safeJSONParse(req.body.production, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const productionLink =
      req.body.productionLink || "";

    const title = req.body.title
      ? safeJSONParse(req.body.title, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const titleLink = req.body.titleLink || "";

    const category = req.body.category
      ? safeJSONParse(req.body.category, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const categoryLink =
      req.body.categoryLink || "";

    const subcategory = req.body.subcategory
      ? safeJSONParse(req.body.subcategory, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const subcategoryLink =
      req.body.subcategoryLink || "";

    const brand = req.body.brand
      ? safeJSONParse(req.body.brand, {
          name: { uk: "", en: "" },
          brandLink: "",
        })
      : {
          name: { uk: "", en: "" },
          brandLink: "",
        };

    const description = req.body.description
      ? safeJSONParse(req.body.description, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const features = req.body.features
      ? safeJSONParse(req.body.features, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const neededs = req.body.neededs
      ? safeJSONParse(req.body.neededs, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };
    const added = req.body.added
      ? safeJSONParse(req.body.added, {
          uk: "",
          en: "",
        })
      : { uk: "", en: "" };

    // 6. Парсим variation
    const variation = req.body.variation
      ? safeJSONParse(req.body.variation, {
          name: "",
          variations: [],
        })
      : { name: "", variations: [] };

    // 7. Парсим characteristics
    const parsedCharacteristicsObj = req.body
      .characteristics
      ? safeJSONParse(req.body.characteristics, {
          type: [],
          default: [],
        })
      : { type: [], default: [] };
    const characteristicsArray = Array.isArray(
      parsedCharacteristicsObj.type
    )
      ? parsedCharacteristicsObj.type.map(
          (item) => ({
            key: item.key,
            value: item.value,
            unit: item.unit,
          })
        )
      : [];

    // 8. Парсим delivery
    let rawDelivery = {};
    if (req.body.delivery) {
      if (typeof req.body.delivery === "string") {
        rawDelivery = safeJSONParse(
          req.body.delivery,
          {}
        );
      } else if (
        typeof req.body.delivery === "object"
      ) {
        rawDelivery = req.body.delivery;
      }
    }
    const delivery = {
      self_pickup:
        rawDelivery.self_pickup === true ||
        rawDelivery.self_pickup === "true",
    };

    // 9. Числовые поля quantity, discount, multiplicity
    const quantity =
      rawQuantity != null
        ? Number(rawQuantity)
        : undefined;
    const multiplicity =
      rawMultiplicity != null
        ? Number(rawMultiplicity)
        : 0;
    const discount =
      rawDiscount != null
        ? Number(rawDiscount)
        : 0;

    // 10. Булево поле isNew
    const isNew =
      rawIsNew === "true" || rawIsNew === true;

    // 11. Валютный курс и cost
    const setting = await Settings.findOne({
      key: "exchangeRate",
    });
    const rate = setting ? setting.value : 45;
    let cost;
    if (rawCostEUR != null) {
      const n = Number(rawCostEUR);
      cost = !isNaN(n)
        ? Math.round(n * rate)
        : undefined;
    } else if (rawCost != null) {
      cost = Number(rawCost);
    }

    // 12. Вычисляем computedPrice
    const varArr = Array.isArray(
      variation.variations
    )
      ? variation.variations
      : [];
    const basePrice =
      varArr.length > 0
        ? Number(varArr[0].price)
        : cost || 0;
    const computedPrice = Math.round(
      basePrice - (basePrice * discount) / 100
    );

    // 13. Находим существующий продукт по unique field (id или _id)
    // Предполагаем, что req.params.id — это уникальное поле id
    const product = await Product.findOne({
      id: req.params.id,
    });
    if (!product) {
      return res
        .status(404)
        .json({ message: "Product not found" });
    }

    // 14. Парсим и обновляем components, только если пришло в запросе
    if (req.body.components !== undefined) {
      let rawComponents;
      if (
        typeof req.body.components === "string"
      ) {
        rawComponents = safeJSONParse(
          req.body.components,
          null
        );
      } else if (
        typeof req.body.components === "object" &&
        req.body.components !== null
      ) {
        rawComponents = req.body.components;
      } else {
        rawComponents = null;
      }

      let parsedComponents;
      if (
        rawComponents &&
        typeof rawComponents === "object" &&
        Array.isArray(rawComponents.columns) &&
        Array.isArray(rawComponents.rows)
      ) {
        // Уже в новом формате
        parsedComponents = rawComponents;
      } else if (
        Array.isArray(rawComponents) &&
        rawComponents.length > 0 &&
        rawComponents.every(
          (item) =>
            item &&
            typeof item === "object" &&
            ("uk" in item || "en" in item)
        )
      ) {
        // Старый формат массива мультиязычных строк
        parsedComponents = transformOldComponents(
          rawComponents
        );
      } else {
        // Некорректный или пустой — можно оставить пустую структуру или не менять текущее
        parsedComponents = {
          columns: [],
          rows: [],
        };
      }
      product.components = parsedComponents;
    }
    // Если components не пришло, оставляем product.components без изменений

    // 15. Обновляем остальные поля
    product.production = production;
    product.productionLink = productionLink;
    product.title = title;
    product.titleLink = titleLink;
    if (
      req.body.category != "" &&
      Object.keys(category).length > 0
    )
      product.category = category;
    if (
      req.body.categoryLink != "" &&
      categoryLink
    )
      product.categoryLink = categoryLink;
    if (
      req.body.subcategory != "" &&
      Object.keys(subcategory).length > 0
    )
      product.subcategory = subcategory;
    if (
      req.body.subcategoryLink != "" &&
      subcategoryLink
    )
      product.subcategoryLink = subcategoryLink;

    console.log(
      category,
      categoryLink,
      subcategory,
      subcategoryLink
    );

    product.brand = brand;
    product.packing = req.body.packing || "";
    product.shelfTime = req.body.shelfTime || "";
    product.type = req.body.type || "";
    product.types = req.body.types || "";
    product.application = application;
    product.delivery = delivery;
    product.imageURL = imageURLs;
    product.composition = composition;
    product.variation = variation;
    product.description = description;
    product.features = features;
    product.neededs = neededs;
    // product.components обновлено выше, если было в запросе
    product.added = added;
    product.characteristics =
      characteristicsArray;
    product.cost = cost;
    product.sku = rawSku || "";
    product.quantity = quantity;
    product.multiplicity = multiplicity;
    product.discount = discount;
    product.computedPrice = computedPrice;
    product.isNew = isNew;

    // 16. Сохраняем изменения
    await product.save();

    return res.json(product);
  } catch (err) {
    console.error(
      "Ошибка при обновлении товара:",
      err
    );
    return res
      .status(400)
      .json({ message: err.message });
  }
};

// Удалить товар по id
export const deleteProduct = async (req, res) => {
  try {
    const deletedProduct =
      await Product.findOneAndDelete({
        id: req.params.id,
      });
    if (!deletedProduct)
      return res
        .status(404)
        .json({ message: "Product not found" });
    res.json({
      message: "Product deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};

export async function getProductGroups(req, res) {
  await connectDB();
  try {
    const { code, sku } = req.query; // ?code=123
    console.log(req.query);
    const matchStage =
      code || sku
        ? {
            $or: [
              code
                ? {
                    "variations.variations.code":
                      Number(code),
                  }
                : null,
              sku
                ? {
                    "variations.variations.sku":
                      String(sku),
                  }
                : null,
            ].filter(Boolean),
          }
        : {};

    const groups = await Product.aggregate([
      { $match: matchStage }, // фильтруем сразу по коду вариации, если передан
      { $sort: { groupId: -1, id: 1 } },
      {
        $group: {
          _id: "$groupId",
          titleUa: { $first: "$title.ua" },
          titleRu: { $first: "$title.ru" },
          skuSample: { $first: "$sku" },
          // добавим первый код вариации для фронта
          codeSample: {
            $first: {
              $arrayElemAt: [
                "$variations.variations.code",
                0,
              ],
            },
          },
          count: { $sum: 1 },
          previewImg: {
            $first: {
              $arrayElemAt: [
                {
                  $map: {
                    input:
                      "$variations.variations",
                    as: "v",
                    in: {
                      $arrayElemAt: [
                        "$$v.img",
                        0,
                      ],
                    },
                  },
                },
                0,
              ],
            },
          },
          categoryLink: {
            $first: "$categoryLink",
          },
          categoryNameUa: {
            $first: "$category.ua",
          },
          categoryNameRu: {
            $first: "$category.ru",
          },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          _id: 0,
          groupId: "$_id",
          title: {
            ua: "$titleUa",
            ru: "$titleRu",
          },
          skuSample: 1,
          codeSample: 1, // чтобы на фронте можно было искать и по коду
          variationsCount: "$count",
          previewImage: "$previewImg.img_link",
          categoryLink: 1,
          category: {
            ua: "$categoryNameUa",
            ru: "$categoryNameRu",
          },
        },
      },
    ]);
    // console.log(groups)
    res.json(groups);
  } catch (err) {
    console.error(
      "Error in getProductGroups:",
      err
    );
    res
      .status(500)
      .json({ message: err.message });
  }
}

/**
 * GET /admin/api/products/group/:groupId
 * Возвращает одну группу товаров без дублей вариаций
 */
export async function getProductGroupById(
  req,
  res
) {
  try {
    const groupId = Number(req.params.groupId);
    if (Number.isNaN(groupId)) {
      return res
        .status(400)
        .json({ message: "Invalid groupId" });
    }

    const products = await Product.find({
      groupId,
    });
    if (!products.length) {
      return res
        .status(404)
        .json({ message: "Group not found" });
    }

    const name = products[0].title;

    // Собираем вариации из каждой карточки (по одной вариации на карточку)
    const variations = products
      .map((p) => p.variations?.variations?.[0])
      .filter(Boolean);

    res.json({ name, variations, products });
  } catch (err) {
    console.error(
      "Error in getProductGroupById:",
      err
    );
    res
      .status(500)
      .json({ message: err.message });
  }
}

/**
 * POST /admin/api/products/group
 * Создаёт новую группу — разбивает на отдельные продукты
 */

const makeSlug = (str) => {
  return (str || "")
    .normalize("NFKD")
    .replace(/\s+/g, "-") // <-- это важно! заменяет все пробелы на дефис
    .replace(/[їі]/gi, (ch) =>
      ch === "ї" ? "yi" : "i"
    )
    .replace(/[є]/gi, "ie")
    .replace(/[ґ]/gi, "g")
    .replace(/[а-яёa-z0-9()]+/gi, (txt) =>
      slugify(txt, {
        lower: true,
        locale: "uk",
        remove: /[^a-zA-Z0-9()\-_]/g,
        strict: false,
        replacement: "-",
      })
    )
    .replace(/[^a-zA-Z0-9()]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export async function createProductGroup(
  req,
  res
) {
  const T0 = Date.now();
  const LOG = (...a) =>
    console.log("[createProductGroup]", ...a);
  const ERR = (...a) =>
    console.error(
      "[createProductGroup][ERROR]",
      ...a
    );

  try {
    await connectDB();

    // ---- Заголовки/протокол (debug)
    LOG("CT:", req.headers["content-type"]);
    LOG(
      "X-Forwarded-Proto:",
      req.headers["x-forwarded-proto"]
    );
    LOG(
      "X-Forwarded-Host:",
      req.headers["x-forwarded-host"]
    );
    LOG("req.protocol:", req.protocol);
    LOG("req.headers.host:", req.headers.host);

    // ---- JSON-поля
    const fields = parseJsonFields(req.body, [
      "variations",
      "manualSearchTags",
      "components",
      "characteristics",
      "dimensions",
      "title",
      "titleLink",
      "category",
      "categoryLink",
      "subcategory",
      "subcategoryLink",
      "country",
      "unit",
      "description",
      "imageURL", // иногда вы шлёте imageURL
      // "images" — не парсим здесь специально, ниже возьмём напрямую из req.body
    ]);

    LOG(
      "Parsed fields keys:",
      Object.keys(fields)
    );
    LOG(
      "Title UA/RU:",
      fields?.title?.ua,
      "|",
      fields?.title?.ru
    );
    LOG(
      "Variations shape:",
      fields?.variations && {
        hasName: !!fields.variations.name,
        vCount: Array.isArray(
          fields?.variations?.variations
        )
          ? fields.variations.variations.length
          : 0,
      }
    );

    const baseCharacteristics = Array.isArray(
      fields.characteristics
    )
      ? fields.characteristics
      : [];
    const rootTags = Array.isArray(
      fields.manualSearchTags
    )
      ? fields.manualSearchTags
          .map((t) => String(t).trim())
          .filter(Boolean)
      : typeof fields.manualSearchTags ===
        "string"
      ? fields.manualSearchTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    LOG("Root manualSearchTags:", rootTags);

    // ---- Счётчик groupId
    const groupCounter =
      await Counter.findByIdAndUpdate(
        { _id: "productGroupId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
    const groupId = groupCounter.seq;
    LOG("Generated groupId:", groupId);

    // ---- Папка загрузок
    const uploadDir = path.resolve(
      process.cwd(),
      "public",
      "uploads"
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, {
        recursive: true,
      });
      LOG("Created uploadDir:", uploadDir);
    } else {
      LOG("Using uploadDir:", uploadDir);
    }

    // ---- Файлы (multer.any())
    const files = req.files || [];
    LOG(
      "Incoming files count:",
      files.length,
      "fieldnames:",
      files.map((f) => f.fieldname)
    );

    // ---- Базовый URL (proxy/локально)
    const proto =
      req.headers["x-forwarded-proto"] ||
      req.protocol ||
      "http";
    const host =
      req.headers["x-forwarded-host"] ||
      req.headers.host;
    const base =
      process.env.PUBLIC_BASE_URL ||
      `${proto}://${host}`;
    LOG("base:", base);

    // ---- fileMap[fieldname] = [url, ...]
    const fileMap = {};
    for (const file of files) {
      try {
        const ext =
          path.extname(file.originalname) || "";
        const filename = `${Date.now()}-${Math.random()
          .toString()
          .slice(2)}${ext}`;
        const dest = path.join(
          uploadDir,
          filename
        );

        if (
          file.path &&
          fs.existsSync(file.path)
        ) {
          fs.renameSync(file.path, dest);
        } else if (file.buffer) {
          fs.writeFileSync(dest, file.buffer);
        } else {
          LOG(
            "WARN: file has neither path nor buffer:",
            file.fieldname,
            file.originalname
          );
          continue;
        }

        const url = `${base}/uploads/${filename}`;
        fileMap[file.fieldname] =
          fileMap[file.fieldname] || [];
        fileMap[file.fieldname].push(url);
      } catch (e) {
        ERR(
          "Failed to persist file:",
          file.fieldname,
          e
        );
      }
    }
    LOG("fileMap keys:", Object.keys(fileMap));

    // ---- Общие картинки: из файлов ИЛИ из JSON (imageURL или images)
    const commonImagesFromFiles =
      fileMap["images"] || [];
    const commonImagesFromJson = (
      Array.isArray(req.body.images)
        ? req.body.images
        : []
    ) // если пришло как массив
      .concat(
        Array.isArray(fields.imageURL)
          ? fields.imageURL
          : []
      ); // или как imageURL
    const commonImages =
      commonImagesFromFiles.length
        ? commonImagesFromFiles
        : commonImagesFromJson;
    LOG(
      "commonImages count:",
      commonImages.length
    );

    // ---- Картинки вариаций из файлов: аккумулируем по индексу
    const variantFiles = Object.entries(fileMap)
      .filter(([key]) =>
        key.startsWith("variations.variations[")
      )
      .reduce((acc, [key, urls]) => {
        const m = key.match(/\[(\d+)\]/);
        if (!m) return acc;
        const idx = Number(m[1]);
        acc[idx] = [...(acc[idx] || []), ...urls];
        return acc;
      }, {});
    LOG(
      "variantFiles index → count:",
      Object.fromEntries(
        Object.entries(variantFiles).map(
          ([k, v]) => [k, v.length]
        )
      )
    );

    // ---- Чистые вариации: файлы ИЛИ JSON
    const raw = fields.variations || {};
    const originalList = Array.isArray(
      raw.variations
    )
      ? raw.variations
      : [];
    LOG(
      "originalList length:",
      originalList.length
    );

    const cleanVariants = originalList.map(
      (v, i) => {
        // из файлов
        const fromFiles = (
          variantFiles[i] || []
        ).map((url) => ({
          img_link: url,
        }));
        // из JSON (v.img может быть [{img_link}] или [string])
        const fromJson = Array.isArray(v.img)
          ? v.img.map((x) =>
              typeof x === "string"
                ? { img_link: x }
                : x
            )
          : [];

        const mapped = {
          ...v,
          manualSearchTags: Array.isArray(
            v.manualSearchTags
          )
            ? v.manualSearchTags
                .map((t) => String(t).trim())
                .filter(Boolean)
            : [],
          img: fromFiles.length
            ? fromFiles
            : fromJson, // Fallback
          characteristics:
            Array.isArray(v.characteristics) &&
            v.characteristics.length
              ? v.characteristics
              : baseCharacteristics,
          description: {
            ua:
              v.description?.ua ??
              fields.description?.ua ??
              "",
            ru:
              v.description?.ru ??
              fields.description?.ru ??
              "",
          },
        };

        LOG(`[cleanVariants #${i}]`, {
          tags: mapped.manualSearchTags.length,
          imgs: mapped.img.length,
          hasChars:
            mapped.characteristics?.length || 0,
          descUA: mapped.description.ua?.slice(
            0,
            40
          ),
        });

        return mapped;
      }
    );

    // ---- Если вариаций нет — создаём заглушку
    const variantList =
      cleanVariants.length > 0
        ? cleanVariants
        : [
            {
              manualSearchTags: [],
              characteristics:
                baseCharacteristics,
              description: fields.description || {
                ua: "",
                ru: "",
              },
              img: [],
            },
          ];

    // ---- Генерация документов
    const docs = [];
    const baseUa = fields?.title?.ua || "";
    const baseRu = fields?.title?.ru || "";
    const baseSlug = makeSlug(baseUa);

    for (const [
      i,
      variant,
    ] of variantList.entries()) {
      const prodCounter =
        await Counter.findByIdAndUpdate(
          { _id: "productId" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
      const productId = prodCounter.seq;

      const optUa = variant.option?.ua || "";
      const slugOpt = makeSlug(optUa);
      const titleLink = slugOpt
        ? `${baseSlug}-${slugOpt}`
        : baseSlug;

      const title = {
        ua: optUa
          ? `${baseUa}; ${optUa}`
          : baseUa,
        ru: variant.option?.ru
          ? `${baseRu}; ${variant.option.ru}`
          : baseRu,
      };

      const productTags = Array.from(
        new Set([
          ...rootTags,
          ...(variant.manualSearchTags || []),
          title.ua.trim().toLowerCase(),
          title.ru.trim().toLowerCase(),
          String(variant.sku || "").toLowerCase(),
          String(
            variant.code || ""
          ).toLowerCase(),
        ])
      );

      const doc = {
        id: productId,
        groupId,
        code: Number(fields.code) || 0,
        title,
        titleLink,
        category: fields.category,
        categoryLink: fields.categoryLink,
        subcategory: fields.subcategory,
        subcategoryLink: fields.subcategoryLink,
        country: fields.country,
        unit: fields.unit,
        description: fields.description, // общий (топовый)
        manualSearchTags: productTags,
        components: fields.components,
        dimensions: fields.dimensions,
        characteristics: variant.characteristics,
        retailPrice:
          Number(req.body.retailPrice) || 0,
        wholesalePrice:
          Number(req.body.wholesalePrice) || 0,
        cost: Number(req.body.cost) || 0,
        opt_cost: Number(req.body.opt_cost) || 0,
        quantity: Number(req.body.quantity) || 0,
        discount: Number(req.body.discount) || 0,
        weight: Number(req.body.weight) || 0,
        multiplicity:
          Number(req.body.multiplicity) || 1,
        sku: fields.sku,
        // главные изображения: из файлов или JSON
        imageURL: commonImages,
        // изображения вариации: уже нормализованные
        img: (variant.img || []).map((x) =>
          typeof x === "string"
            ? { img_link: x }
            : x
        ),
        option: variant.option || {},
        price:
          variant.price ??
          Number(fields.cost) ??
          0,
        // внутри продукта храним только текущую вариацию
        variations: raw.name
          ? {
              name: raw.name,
              variations: [variant],
            }
          : {},
      };

      // Курс
      const setting = await Settings.findOne({
        key: "exchangeRate",
      });
      const rate = Number(setting?.value) || 40;

      // Пересчёт opt_price_uah (если вложенные вариации присутствуют)
      if (doc.variations?.variations?.length) {
        doc.variations.variations =
          doc.variations.variations.map((v) => {
            const parsedOptPrice = Number(
              v.opt_price
            );
            return {
              ...v,
              opt_price_uah: Number.isFinite(
                parsedOptPrice
              )
                ? +(
                    parsedOptPrice * rate
                  ).toFixed(2)
                : 0,
            };
          });
      }

      LOG(`[doc #${i}]`, {
        id: doc.id,
        title: doc.title.ua,
        imgs: doc.img.length,
        commonImages: doc.imageURL.length,
        hasNestedVars:
          !!doc.variations?.variations?.length,
      });

      docs.push(doc);
    }

    const inserted = await Product.insertMany(
      docs
    );
    LOG(
      "Inserted docs:",
      inserted.length,
      "ids:",
      inserted.map((d) => d.id)
    );
    LOG("DONE in", Date.now() - T0, "ms");

    return res.status(201).json({
      name: fields?.variations?.name || "",
      products: inserted,
    });
  } catch (err) {
    ERR(err);
    return res
      .status(400)
      .json({ message: err.message });
  }
}

/**
 * PUT /admin/api/products/group/:id
 * Обновляет группу — синхронизирует вариации без дублей
 */
function sanitizeNumericFields(obj, keys) {
  for (const key of keys) {
    const val = obj[key];
    if (
      val === "" ||
      val === "null" ||
      val === null ||
      val === undefined
    ) {
      obj[key] = undefined;
    } else {
      const num = Number(val);
      obj[key] = Number.isNaN(num)
        ? undefined
        : num;
    }
  }
  return obj;
}

function cleanNumberField(value) {
  if (
    value === "null" ||
    value === null ||
    value === "" ||
    typeof value === "undefined"
  ) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export async function updateProductGroup(
  req,
  res
) {
  try {
    await connectDB();

    // 1. Получаем курс валют
    const setting = await Settings.findOne({
      key: "exchangeRate",
    });
    const rate = setting?.value || 1;
    console.log("[DEBUG] Exchange rate:", rate);

    // 2. Валидируем groupId
    const groupId = Number(req.params.id);
    if (Number.isNaN(groupId)) {
      return res
        .status(400)
        .json({ message: "Invalid groupId" });
    }

    // 3. Проверяем, существует ли группа
    const existingGroup = await Product.findOne({
      groupId,
    });
    if (!existingGroup) {
      return res
        .status(404)
        .json({ message: "Group not found" });
    }
    console.log("[DEBUG] Loaded group:", {
      groupId,
      title: existingGroup?.title,
      category: existingGroup?.category,
    });

    // 4. Парсим поля из тела запроса
    const fields = parseJsonFields(req.body, [
      "title",
      "titleLink",
      "category",
      "categoryLink",
      "subcategory",
      "subcategoryLink",
      "country",
      "unit",
      "description",
      "manualSearchTags",
      "components",
      "characteristics",
      "dimensions",
      "multiplicity",
      "min_count",
    ]);
    console.log("[DEBUG] Parsed fields:", fields);

    // 5. Сохраняем ru-версии категории и подкатегории, если не пришли
    const existingCategory =
      existingGroup.category || {
        ua: "",
        ru: "",
      };
    const existingSubcategory =
      existingGroup.subcategory || {
        ua: "",
        ru: "",
      };
    fields.category.ru =
      fields.category.ru?.trim() ||
      existingCategory.ru;
    fields.subcategory.ru =
      fields.subcategory.ru?.trim() ||
      existingSubcategory.ru;

    // 6. Базовые значения
    const { ua: rawUa, ru: rawRu } = fields.title;
    const baseUa = rawUa.split(";")[0].trim();
    const baseRu = rawRu.split(";")[0].trim();

    // Унифицированная функция для slug
    const makeSlug = (str) => {
      return (str || "")
        .normalize("NFKD") // кириллица → латиница
        .replace(/[їі]/gi, (ch) =>
          ch === "ї" ? "yi" : "i"
        ) // если надо
        .replace(/[є]/gi, "ie")
        .replace(/[ґ]/gi, "g")
        .replace(/[а-яёa-z0-9()]+/gi, (txt) =>
          slugify(txt, {
            lower: true,
            locale: "uk",
            remove: /[^a-zA-Z0-9()\-_]/g,
            strict: false,
          })
        )
        .replace(/[^a-zA-Z0-9()]+/g, "-") // всё остальное на дефис
        .replace(/-+/g, "-") // убрать повторяющиеся дефисы
        .replace(/^-|-$/g, ""); // убрать крайние дефисы
    };

    const baseSlug = makeSlug(baseUa);

    console.log("[DEBUG] Base for slug:", {
      baseUa,
      baseSlug,
    });

    // 7. Парсим вариации
    const raw = JSON.parse(
      req.body.variations || "{}"
    );
    const variations = Array.isArray(
      raw.variations
    )
      ? raw.variations
      : [];
    console.log(
      "[DEBUG] Parsed variations count:",
      variations.length
    );

    // 8. Подготавливаем общие данные для всех документов
    const orOld = (val, oldVal) =>
      val && val.trim() ? val : oldVal;
    const commonSet = {
      category: fields.category,
      categoryLink: orOld(
        fields.categoryLink,
        existingGroup?.categoryLink
      ),
      subcategory: fields.subcategory,
      subcategoryLink: orOld(
        fields.subcategoryLink,
        existingGroup?.subcategoryLink
      ),
      country: fields.country,
      unit: fields.unit,
      multiplicity: fields.multiplicity,
      min_count: fields.min_count,
      description: fields.description,
      components: fields.components,
      dimensions: fields.dimensions,
      retailPrice:
        Number(req.body.retailPrice) || 0,
      wholesalePrice:
        Number(req.body.wholesalePrice) || 0,
      cost: Number(req.body.cost) || 0,
      opt_cost: Number(req.body.opt_cost) || 0,
      opt_cost_uah: +(
        (Number(req.body.opt_cost) || 0) * rate
      ).toFixed(2),
      discount: Number(req.body.discount) || 0,
      weight: Number(req.body.weight) || 0,
    };

    // 9. Обрабатываем удаляемые изображения
    let deletedImages = [];
    const rawDeleted = req.body.deletedImages;
    if (Array.isArray(rawDeleted)) {
      rawDeleted.forEach((item) => {
        if (typeof item === "string") {
          try {
            deletedImages.push(
              ...JSON.parse(item)
            );
          } catch {
            deletedImages.push(
              ...item.split(",")
            );
          }
        }
      });
    } else if (typeof rawDeleted === "string") {
      try {
        deletedImages = JSON.parse(rawDeleted);
      } catch {
        deletedImages = rawDeleted.split(",");
      }
    }
    deletedImages = deletedImages
      .map((u) => u.trim())
      .filter(Boolean);

    if (deletedImages.length) {
      console.log(
        "[DEBUG] Deleting images:",
        deletedImages
      );
      await Product.updateMany(
        { groupId },
        {
          $pull: {
            imageURL: { $in: deletedImages },
          },
        }
      );
      await Product.updateMany(
        { groupId },
        {
          $pull: {
            "variations.variations.$[].img": {
              img_link: { $in: deletedImages },
            },
          },
        },
        { multi: true }
      );
    }

    // 10. Мэпим существующие варианты по _id
    const existingDocs = await Product.find({
      groupId,
    });
    const existMap = new Map(
      existingDocs.map((doc) => [
        doc.variations?.variations?.[0]?._id?.toString() ||
          "__empty__",
        doc,
      ])
    );
    console.log(
      "[DEBUG] Existing variations in DB:",
      Array.from(existMap.keys())
    );

    // 11. Обработка каждой вариации
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];
      const uaOpt = v.option?.ua?.trim() || "";
      const ruOpt = v.option?.ru?.trim() || uaOpt;
      const titleUa = uaOpt
        ? `${baseUa}; ${uaOpt}`
        : baseUa;
      const titleRu = ruOpt
        ? `${baseRu}; ${ruOpt}`
        : baseRu;

      // СЛАГИ ДЕЛАЕМ ПО АНАЛОГИИ С CREATE!
      const slugOpt = makeSlug(uaOpt);
      const titleLink = slugOpt
        ? `${baseSlug}-${slugOpt}`
        : baseSlug;

      // Для логирования:
      console.log(
        `[DEBUG] Update/Upsert variation ${i}:`,
        {
          vId: v._id?.toString() || "__empty__",
          baseUa,
          uaOpt,
          baseSlug,
          slugOpt,
          titleLink,
          titleUa,
          titleRu,
        }
      );

      // Получаем существующую вариацию
      const vIdStr =
        v._id?.toString() || "__empty__";
      const existingDoc = existMap.get(vIdStr);
      let existingVariation = null,
        existingImages = [];
      if (existingDoc) {
        existingVariation =
          existingDoc.variations?.variations?.find(
            (variation) =>
              variation._id.toString() === vIdStr
          );
        existingImages =
          existingVariation?.img || [];
      }

      // Обновляем список изображений (уникально)
      const updatedImages = [
        ...new Set([
          ...existingImages.map(
            (img) => img.img_link
          ),
          ...(v.img?.map((img) => img.img_link) ||
            []),
        ]),
      ];

      // Универсальный апдейт
      const updateDoc = {
        $set: {
          ...commonSet,
          title: { ua: titleUa, ru: titleRu },
          titleLink,
          characteristics: Array.isArray(
            v.characteristics
          )
            ? v.characteristics
            : [],
          "variations.variations.$[elem].option":
            v.option || {
              ua: "",
              ru: "",
            },
          "variations.variations.$[elem].characteristics":
            v.characteristics || [],
          "variations.variations.$[elem].manualSearchTags":
            v.manualSearchTags || [],
          "variations.variations.$[elem].opt_price_uah":
            +((v.opt_price || 0) * rate).toFixed(
              2
            ),
          "variations.variations.$[elem].description":
            {
              ua:
                v.description?.ua ||
                fields.description.ua,
              ru:
                v.description?.ru ||
                fields.description.ru,
            },
          "variations.variations.$[elem].img":
            updatedImages.map((img_link) => ({
              img_link,
              type: "image",
            })),
          ...(v.relatedProducts
            ? {
                "variations.variations.$[elem].relatedProducts":
                  v.relatedProducts,
              }
            : {}),
        },
      };
      const arrayFilters = [
        { "elem._id": v._id || "" },
      ];

      if (existingDoc) {
        const result = await Product.updateOne(
          {
            groupId,
            "variations.variations._id": v._id,
          },
          updateDoc,
          { arrayFilters }
        );
        console.log(
          `[DEBUG] Updated variation ${vIdStr}`,
          { result }
        );
        existMap.delete(vIdStr);
      } else {
        const ctr =
          await Counter.findByIdAndUpdate(
            { _id: "productId" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
          );
        const newDoc = {
          id: ctr.seq,
          groupId,
          ...commonSet,
          title: { ua: titleUa, ru: titleRu },
          titleLink,
          characteristics:
            v.characteristics || [],
          manualSearchTags: [
            v.manualSearchTags?.[0] || "",
          ],
          variations: {
            name: fields.title,
            variations: [
              {
                ...v,
                characteristics:
                  v.characteristics || [],
                manualSearchTags:
                  v.manualSearchTags || [],
                opt_price_uah: +(
                  (v.opt_price || 0) * rate
                ).toFixed(2),
                description: {
                  ua:
                    v.description?.ua ||
                    fields.description.ua,
                  ru:
                    v.description?.ru ||
                    fields.description.ru,
                },
                img: updatedImages.map(
                  (img_link) => ({
                    img_link,
                    type: "image",
                  })
                ),
                relatedProducts:
                  v.relatedProducts || [],
              },
            ],
          },
        };
        await new Product(newDoc).save();
        console.log(
          `[DEBUG] Created variation ${vIdStr} (id=${ctr.seq})`
        );
      }
    }

    // 12. Удаление неиспользуемых вариантов
    const newOptionsSet = new Set(
      variations.map(
        (v) => v._id?.toString() || "__empty__"
      )
    );
    const toDelete = Array.from(
      existMap.entries()
    )
      .filter(
        ([uaOpt]) => !newOptionsSet.has(uaOpt)
      )
      .map(([, doc]) => doc.id);

    if (toDelete.length) {
      await Product.deleteMany({
        groupId,
        id: { $in: toDelete },
      });
      console.log(
        "[DEBUG] Deleted old variations:",
        toDelete
      );
    }

    // Финальный дебаг — все товары группы
    const afterDocs = await Product.find({
      groupId,
    });
    console.log("[DEBUG] FINAL STATE:");
    afterDocs.forEach((doc) => {
      console.log({
        id: doc.id,
        titleLink: doc.titleLink,
        title: doc.title,
        categoryLink: doc.categoryLink,
        subcategoryLink: doc.subcategoryLink,
      });
    });

    return res.json({
      message: "Group updated successfully",
    });
  } catch (err) {
    console.error(
      "[ERROR] updateProductGroup exception:",
      err
    );
    return res
      .status(500)
      .json({ message: err.message });
  }
}

/**
 * DELETE /admin/api/products/groups/:groupId
 */
export async function deleteProductGroup(
  req,
  res
) {
  await connectDB();
  try {
    const groupId = Number(req.params.groupId);
    if (Number.isNaN(groupId)) {
      return res
        .status(400)
        .json({ message: "Invalid groupId" });
    }
    await Product.deleteMany({ groupId });
    res.status(204).end();
  } catch (err) {
    console.error(
      "Error in deleteProductGroup:",
      err
    );
    res
      .status(500)
      .json({ message: err.message });
  }
}

export async function searchProducts(req, res) {
  try {
    const qRaw = (req.query.q || "").trim();
    if (!qRaw) return res.json([]);
    console.log(req.query.q);
    const safe = qRaw.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const regex = new RegExp(safe, "i");
    const isNum = !isNaN(qRaw);
    const asNum = isNum ? Number(qRaw) : null;

    const or = [
      { "title.ua": regex },
      { "title.ru": regex },
      { "variations.variations.sku": regex },
      { sku: regex },
      { code: regex },
    ];

    if (isNum) {
      or.push({
        "variations.variations.code": asNum,
      });
      or.push({ code: asNum });
      or.push({
        "variations.variations.code": qRaw,
      });
      or.push({ code: qRaw });
    } else {
      or.push({
        "variations.variations.code": regex,
      });
    }

    const pipeline = [
      { $match: { $or: or } },
      // считаем простую релевантность
      {
        $addFields: {
          _t: qRaw.toLowerCase(),
          exactSkuTop: {
            $eq: [
              {
                $toLower: {
                  $ifNull: ["$sku", ""],
                },
              },
              qRaw.toLowerCase(),
            ],
          },
          exactCodeTop: {
            $eq: [{ $toString: "$code" }, qRaw],
          },
          titleHit: {
            $or: [
              {
                $regexMatch: {
                  input: {
                    $ifNull: ["$title.ua", ""],
                  },
                  regex: regex,
                },
              },
              {
                $regexMatch: {
                  input: {
                    $ifNull: ["$title.ru", ""],
                  },
                  regex: regex,
                },
              },
            ],
          },
        },
      },
      {
        $unwind: {
          path: "$variations.variations",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          exactSkuVar: {
            $eq: [
              {
                $toLower: {
                  $ifNull: [
                    "$variations.variations.sku",
                    "",
                  ],
                },
              },
              qRaw.toLowerCase(),
            ],
          },
          exactCodeVar: {
            $or: [
              {
                $eq: [
                  {
                    $toString:
                      "$variations.variations.code",
                  },
                  qRaw,
                ],
              },
              isNum
                ? {
                    $eq: [
                      "$variations.variations.code",
                      asNum,
                    ],
                  }
                : false,
            ],
          },
          regexSkuVar: {
            $regexMatch: {
              input: {
                $ifNull: [
                  "$variations.variations.sku",
                  "",
                ],
              },
              regex: regex,
            },
          },
          regexCodeVar: {
            $regexMatch: {
              input: {
                $toString: {
                  $ifNull: [
                    "$variations.variations.code",
                    "",
                  ],
                },
              },
              regex: regex,
            },
          },
        },
      },
      {
        $addFields: {
          relevance: {
            $add: [
              {
                $cond: ["$exactCodeTop", 100, 0],
              },
              { $cond: ["$exactSkuTop", 90, 0] },
              { $cond: ["$exactCodeVar", 80, 0] },
              { $cond: ["$exactSkuVar", 70, 0] },
              { $cond: ["$regexSkuVar", 10, 0] },
              { $cond: ["$regexCodeVar", 10, 0] },
              { $cond: ["$titleHit", 5, 0] },
            ],
          },
        },
      },
      // Собираем обратно по продукту, берём максимальную релевантность
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          relevance: { $max: "$relevance" },
        },
      },
      { $sort: { relevance: -1, _id: 1 } },
      {
        $project: {
          _id: 1,
          title: "$doc.title",
          imageURL: "$doc.imageURL",
          relevance: 1,
          "variations.variations.sku": 1,
          "variations.variations.code": 1,
          sku: "$doc.sku",
          code: "$doc.code",
        },
      },
      { $limit: 20 },
    ];

    const docs = await Product.aggregate(
      pipeline
    ).exec();
    console.log(docs);
    res.json(docs);
  } catch (err) {
    console.error("[searchProducts]", err);
    res
      .status(500)
      .json({ message: "Search error" });
  }
}

export async function getProductsByIds(req, res) {
  try {
    let ids = req.query.ids || [];
    if (typeof ids === "string")
      ids = ids.split(",");
    ids = ids.filter(Boolean);
    if (!ids.length) return res.json([]);

    // Оптимизировано: выбираем только нужные поля (и по необходимости populate)
    const products = await Product.find({
      _id: { $in: ids },
    })
      .select("_id title sku code imageURL")
      .lean();

    // Сортируем по порядку id (как пришло)
    const idToIndex = Object.fromEntries(
      ids.map((id, i) => [id, i])
    );
    products.sort(
      (a, b) =>
        (idToIndex[a._id.toString()] ?? 0) -
        (idToIndex[b._id.toString()] ?? 0)
    );

    res.json(products);
  } catch (err) {
    console.error("[getProductsByIds]", err);
    res.status(500).json({
      message:
        "Ошибка получения связанных товаров",
    });
  }
}
