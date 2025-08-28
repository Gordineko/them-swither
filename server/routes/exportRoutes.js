// routes/adminExport.js
import express from "express";
import ExcelJS from "exceljs";
import Product from "../models/Product.js"; // скорректируй путь под свой проект

const router = express.Router();

/**
 * GET /api/admin/export-products
 * Генерирует Excel и стримит его в ответ
 */
router.get("/export-products", async (req, res) => {
    // Название файла
    const filename = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Заголовки до начала стрима
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Стримовый writer
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet("Товари");

    // Определяем колонки
    sheet.columns = [
        { header: "Назва товару", key: "title_ua", width: 50 },
        { header: "Категорія", key: "category_ua", width: 30 },
        { header: "Підкатегорія", key: "subcategory_ua", width: 30 },
        { header: "Ціна", key: "opt_price_uah", width: 15 },
        { header: "Артикул", key: "sku", width: 28 },
        { header: "Код", key: "code", width: 12 },
    ];

    try {
        // Вытягиваем только нужные поля (ускорит и облегчит ответ)
        const cursor = Product.find({}, {
            "title.ua": 1,
            "category.ua": 1,
            "subcategory.ua": 1,
            "variations.variations": 1,
        }).lean().cursor();

        for await (const p of cursor) {
            const titleUa = p?.title?.ua || "";
            const categoryUa = p?.category?.ua || "";
            const subcategoryUa = p?.subcategory?.ua || "";

            const list = Array.isArray(p?.variations?.variations)
                ? p.variations.variations
                : [];

            if (list.length === 0) {
                // Если вариаций нет — можно пропустить, либо записать строку без sku/code (по желанию)
                continue;
            }

            for (const v of list) {
                sheet.addRow({
                    title_ua: titleUa,
                    category_ua: categoryUa,
                    subcategory_ua: subcategoryUa,
                    opt_price_uah: v?.opt_price_uah ?? "",
                    sku: v?.sku ?? "",
                    code: v?.code ?? "",
                }).commit();
            }
        }

        await workbook.commit(); // завершить стрим и ответ
    } catch (err) {
        console.error("Export error:", err);
        // Если уже начали писать в поток, менять заголовки нельзя —
        // но можно поставить статус и завершить
        if (!res.headersSent) {
            res.status(500);
        }
        // Отдаём простое сообщение в тело
        res.end("Export failed");
    }
});

export default router;
