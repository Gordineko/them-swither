import fs from "fs";
import path from "path";
import slugify from "slugify";

import mongoose from "mongoose";

/**
 * Парсит поля из req.body, распознавая JSON-строки по списку ключей.
 */
export function parseJsonFields(
  body,
  jsonFields = []
) {
  const result = {};
  for (const [key, value] of Object.entries(
    body
  )) {
    if (
      jsonFields.includes(key) &&
      typeof value === "string"
    ) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Сохраняет файлы в uploads и возвращает массив публичных URL.
 */
export async function saveFiles(
  files,
  uploadDir
) {
  if (!fs.existsSync(uploadDir))
    fs.mkdirSync(uploadDir, { recursive: true });
  const urls = [];
  for (const file of files) {
    const ext =
      path.extname(
        file.originalname || file.filename
      ) || "";
    const unique =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);
    const filename = `${unique}${ext}`;
    const dest = path.join(uploadDir, filename);

    // Перемещаем файл в целевую директорию
    if (file.path) {
      fs.renameSync(
        path.resolve(file.path),
        dest
      );
    } else if (file.mv) {
      await new Promise((res, rej) =>
        file.mv(dest, (err) =>
          err ? rej(err) : res()
        )
      );
    }

    // Добавляем URL для доступа к файлу

    const fileUrl = `http:// 192.168.0.106:5002/uploads/${filename}`; // Здесь указываем базовый URL

    urls.push(fileUrl);
  }
  return urls;
}

/**
 * Конфиг для разбора и обновления вариаций.
 * Копируйте сюда вашу реализацию из шаблона!
 */
export const variationConfig = {
  parse: async (req, uploadDir) => {
    const rawVar = safeJSONParse(
      req.body.variation,
      {
        name: "",
        variations: [],
      }
    );
    const rawLinks = safeJSONParse(
      req.body.variationLinks,
      {}
    );
    const vars = rawVar.variations.map((v) => ({
      color_name: v.color_name,
      color_code: v.color_code,
      size_on_model: v.size_on_model,
      measurements: v.measurements,
      sizes: Array.isArray(v.sizes)
        ? v.sizes
        : [],
      img: [],
    }));

    // Файлы по индексам
    const filesByIdx = (req.files || [])
      .filter((f) =>
        /^variationImages?\[\d+\]/.test(
          f.fieldname
        )
      )
      .reduce((acc, f) => {
        const idx =
          +f.fieldname.match(/\[(\d+)\]/)[1];
        (acc[idx] = acc[idx] || []).push(f);
        return acc;
      }, {});

    for (const idxStr of Object.keys(
      filesByIdx
    )) {
      const idx = +idxStr;
      const urls = await saveFiles(
        filesByIdx[idx],
        uploadDir
      );
      urls.forEach((u) =>
        vars[idx].img.push({
          img_link: u,
          type: "image",
        })
      );
    }

    // Ссылки по индексам
    for (const [idxStr, links] of Object.entries(
      rawLinks
    )) {
      const arr = Array.isArray(links)
        ? links
        : [links];
      arr
        .filter((l) => l?.trim())
        .forEach((l) =>
          vars[+idxStr].img.push({
            img_link: l.trim(),
            type: "image",
          })
        );
    }

    return {
      name: rawVar.name || "",
      variations: vars,
    };
  },

  update: async (req, entity, uploadDir) => {
    const rawVar = safeJSONParse(
      req.body.variation,
      null
    );
    const rawLinks = safeJSONParse(
      req.body.variationLinks,
      {}
    );
    if (rawVar) {
      entity.variation.name =
        rawVar.name || entity.variation.name;
      if (Array.isArray(rawVar.variations)) {
        entity.variation.variations =
          rawVar.variations.map((v, idx) => ({
            color_name: v.color_name,
            color_code: v.color_code,
            size_on_model: v.size_on_model,
            measurements: v.measurements,
            sizes: Array.isArray(v.sizes)
              ? v.sizes
              : [],
            img:
              entity.variation.variations[idx]
                ?.img || [],
          }));
      }
    }

    const filesByIdx = (req.files || [])
      .filter((f) =>
        /^variationImages?\[\d+\]/.test(
          f.fieldname
        )
      )
      .reduce((acc, f) => {
        const idx =
          +f.fieldname.match(/\[(\d+)\]/)[1];
        (acc[idx] = acc[idx] || []).push(f);
        return acc;
      }, {});

    for (const idxStr of Object.keys(
      filesByIdx
    )) {
      const idx = +idxStr;
      const urls = await saveFiles(
        filesByIdx[idx],
        uploadDir
      );
      urls.forEach((u) =>
        entity.variation.variations[idx].img.push(
          {
            img_link: u,
            type: "image",
          }
        )
      );
    }

    for (const [idxStr, links] of Object.entries(
      rawLinks
    )) {
      const arr = Array.isArray(links)
        ? links
        : [links];
      arr
        .filter((l) => l?.trim())
        .forEach((l) =>
          entity.variation.variations[
            +idxStr
          ].img.push({
            img_link: l.trim(),
            type: "image",
          })
        );
    }
  },
};

// Вспомогательная: безопасно парсит JSON
function safeJSONParse(str, defaultValue) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}
