import Category from "../../models/Category.js";
import Product from "../../models/Product.js";
import fs from "fs";
import path from "path";
// Получить все категорииcd
export const getAllCategories = async (
  req,
  res
) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};

// Получить категорию по _id
export const getCategoryById = async (
  req,
  res
) => {
  try {
    const category = await Category.findById(
      req.params.id
    );
    if (!category)
      return res
        .status(404)
        .json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};

// Создать новую категорию
export const createCategory = async (
  req,
  res
) => {
  try {
    // 1) Parse name if stringified
    if (
      req.body.name &&
      typeof req.body.name === "string"
    ) {
      try {
        req.body.name = JSON.parse(req.body.name);
      } catch {}
    }

    // 2) Parse linkName if stringified
    if (
      req.body.linkName &&
      typeof req.body.linkName === "string"
    ) {
      try {
        req.body.linkName = JSON.parse(
          req.body.linkName
        );
      } catch {
        req.body.linkName =
          req.body.linkName.replace(/^"|"$/g, "");
      }
    }

    // 3) Parse subcategories if stringified
    if (
      req.body.subcategories &&
      typeof req.body.subcategories === "string"
    ) {
      try {
        req.body.subcategories = JSON.parse(
          req.body.subcategories
        );
      } catch {}
    }

    // 4) Initialize subcategories imageURL fields
    let subs = Array.isArray(
      req.body.subcategories
    )
      ? req.body.subcategories.map((sub) => ({
          ...sub,
          imageURL: sub.imageURL || null,
          localImage: null,
        }))
      : [];

    // 5) Handle uploaded files
    // Main category image (multer.single or multer.any)
    if (
      req.file &&
      req.file.fieldname === "image"
    ) {
      req.body.imageURL = `http:// 192.168.0.106:5002/uploads/${encodeURIComponent(
        req.file.filename
      )}`;
    }

    // Subcategory images (multer.any)
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        const match = file.fieldname.match(
          /subcategories\[(\d+)\]\[image\]/
        );
        if (match) {
          const idx = Number(match[1]);
          if (subs[idx]) {
            console.log("FILE:", file);
            subs[
              idx
            ].imageURL = `http:// 192.168.0.106:5002/uploads/${encodeURIComponent(
              file.filename
            )}`;
          }
        }
      });
    }

    // 6) Build and save
    const category = new Category({
      name: req.body.name,
      linkName: req.body.linkName,
      imageURL: req.body.imageURL || null,
      subcategories: subs,
    });
    const newCategory = await category.save();
    res.status(201).json(newCategory);
  } catch (err) {
    res
      .status(400)
      .json({ message: err.message });
  }
};

export const updateCategory = async (
  req,
  res
) => {
  try {
    // 1. Парсим body
    if (
      typeof req.body.subcategories === "string"
    ) {
      try {
        req.body.subcategories = JSON.parse(
          req.body.subcategories
        );
      } catch (e) {
        return res.status(400).json({
          message:
            "Невалидный JSON в поле subcategories",
        });
      }
    }
    if (
      req.body.name &&
      typeof req.body.name === "string"
    ) {
      try {
        req.body.name = JSON.parse(req.body.name);
      } catch {}
    }
    if (
      req.body.linkName &&
      typeof req.body.linkName === "string"
    ) {
      try {
        req.body.linkName = JSON.parse(
          req.body.linkName
        );
      } catch {
        req.body.linkName =
          req.body.linkName.replace(/^"|"$/g, "");
      }
    }
    if (Array.isArray(req.body.subcategories)) {
      req.body.subcategories =
        req.body.subcategories.map((sub) => {
          const parsed = { ...sub };
          if (
            parsed.name &&
            typeof parsed.name === "string"
          ) {
            try {
              parsed.name = JSON.parse(
                parsed.name
              );
            } catch {}
          }
          if (
            parsed.name &&
            typeof parsed.name.ua === "string"
          ) {
            try {
              parsed.name.ua = JSON.parse(
                parsed.name.ua
              );
            } catch {}
          }
          if (
            parsed.name &&
            typeof parsed.name.ru === "string"
          ) {
            try {
              parsed.name.ru = JSON.parse(
                parsed.name.ru
              );
            } catch {}
          }
          if (
            parsed.linkName &&
            typeof parsed.linkName === "string"
          ) {
            try {
              parsed.linkName = JSON.parse(
                parsed.linkName
              );
            } catch {
              parsed.linkName =
                parsed.linkName.replace(
                  /^"|"$/g,
                  ""
                );
            }
          }
          return parsed;
        });
    }

    // 2. Обработка файлов (картинки подкатегорий)
    // Главное изображение категории
    if (
      (req.files &&
        req.files.fieldname === "image") ||
      (req.file && req.file.fieldname === "image")
    ) {
      req.body.imageURL = `http:// 192.168.0.106:5002/uploads/${encodeURIComponent(
        req.file.filename
      )}`;
    }
    // Картинки подкатегорий
    const subImageMap = {};
    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          const m = file.fieldname.match(
            /subcategories\[(\d+)\]\[image\]/
          );
          if (m)
            subImageMap[m[1]] = file.filename;
        });
      } else if (typeof req.files === "object") {
        Object.entries(req.files).forEach(
          ([field, arr]) => {
            arr.forEach((file) => {
              const m = field.match(
                /subcategories\[(\d+)\]\[image\]/
              );
              if (m)
                subImageMap[m[1]] = file.filename;
            });
          }
        );
      }
    }

    // 3. Получаем старую категорию
    const existing = await Category.findById(
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({
        message: "Категория не найдена",
      });
    }

    // 4. Мержим подкатегории по _id
    const incomingSubs = Array.isArray(
      req.body.subcategories
    )
      ? req.body.subcategories
      : [];

    const oldSubsMap = {};
    existing.subcategories.forEach((sub) => {
      if (sub._id)
        oldSubsMap[sub._id.toString()] = sub;
    });

    const mergedSubs = incomingSubs.map(
      (inc, idx) => {
        let orig = null;
        if (inc._id && oldSubsMap[inc._id]) {
          orig = oldSubsMap[inc._id];
        }
        let imageURL = orig?.imageURL || "";
        if (subImageMap[idx]) {
          imageURL = `http:// 192.168.0.106:5002/uploads/${encodeURIComponent(
            subImageMap[idx]
          )}`;
        } else if (
          typeof inc.imageURL === "string" &&
          inc.imageURL
        ) {
          imageURL = inc.imageURL;
        }
        return {
          ...(orig && { _id: orig._id }),
          name: inc.name ?? orig?.name,
          linkName:
            inc.linkName ?? orig?.linkName,
          imageURL,
          order:
            inc.order ?? orig?.order ?? idx + 1,
        };
      }
    );

    // Если добавили новые подкатегории (без _id)
    if (
      incomingSubs.length >
      existing.subcategories.length
    ) {
      const extra = incomingSubs
        .slice(existing.subcategories.length)
        .map((inc, idx) => ({
          name: inc.name,
          linkName: inc.linkName,
          imageURL:
            typeof inc.imageURL === "string" &&
            inc.imageURL
              ? inc.imageURL
              : "",
          order:
            inc.order ??
            existing.subcategories.length +
              idx +
              1,
        }));
      mergedSubs.push(...extra);
    }

    // 5. Сохраняем новую категорию
    const update = {
      name: req.body.name ?? existing.name,
      linkName:
        req.body.linkName ?? existing.linkName,
      imageURL:
        req.body.imageURL ?? existing.imageURL,
      subcategories: mergedSubs,
    };
    const updated =
      await Category.findByIdAndUpdate(
        req.params.id,
        update,
        {
          new: true,
          runValidators: true,
        }
      );

    // ========== ОБНОВЛЯЕМ ТОВАРЫ ==========

    // --- 1. Обновить все товары с этой категорией (если изменили category.ua, category.ru, categoryLink)
    if (
      existing.name?.ua !== update.name.ua ||
      existing.name?.ru !== update.name.ru ||
      existing.linkName !== update.linkName
    ) {
      await Product.updateMany(
        {
          $or: [
            { "category.ua": existing.name?.ua },
            { "category.ru": existing.name?.ru },
            { categoryLink: existing.linkName },
          ],
        },
        {
          $set: {
            "category.ua": update.name.ua,
            "category.ru": update.name.ru,
            categoryLink: update.linkName,
          },
        }
      );
    }

    // --- 2. Обновить товары с изменёнными подкатегориями ---
    for (let i = 0; i < mergedSubs.length; i++) {
      const oldSub = existing.subcategories[i];
      const newSub = mergedSubs[i];
      if (!oldSub || !newSub) continue;

      if (
        oldSub.name?.ua !== newSub.name?.ua ||
        oldSub.name?.ru !== newSub.name?.ru ||
        oldSub.linkName !== newSub.linkName
      ) {
        await Product.updateMany(
          {
            $or: [
              {
                "subcategory.ua": oldSub.name?.ua,
              },
              {
                "subcategory.ru": oldSub.name?.ru,
              },
              {
                subcategoryLink: oldSub.linkName,
              },
            ],
            categoryLink: update.linkName, // только в рамках этой категории!
          },
          {
            $set: {
              "subcategory.ua": newSub.name?.ua,
              "subcategory.ru": newSub.name?.ru,
              subcategoryLink: newSub.linkName,
            },
          }
        );
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error:", err);
    return res
      .status(400)
      .json({ message: err.message });
  }
};

// Удалить категорию по _id
export const deleteCategory = async (
  req,
  res
) => {
  try {
    const deletedCategory =
      await Category.findByIdAndDelete(
        req.params.id
      );
    if (!deletedCategory)
      return res
        .status(404)
        .json({ message: "Category not found" });
    res.json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message });
  }
};
