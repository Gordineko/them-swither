// scripts/generateGoogleFeed.js
import mongoose from "mongoose";
import fs from "fs";
import Product from "../models/Product.js"; // путь к модели
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/ledtech";

async function generateFeed() {
  await mongoose.connect(MONGO_URI);
  const products = await Product.find({
    isVisible: true,
  });

  const items = products.flatMap((product) => {
    const group = product.variations?.variations
      ?.length
      ? product.variations.variations
      : [product];

    return group.map((variation) => {
      const title = variation.option?.ua
        ? `${product.title.ua} ${variation.option.ua}`
        : product.title.ua;

      const description =
        variation.description?.ua ||
        product.description.ua ||
        "";

      const link = `http:// 192.168.0.106:5002/product/${product.categoryLink}/${product.titleLink}`;
      const image =
        variation.img?.[0]?.img_link ||
        product.imageURL?.[0] ||
        "";
      const price =
        variation.price ||
        product.retailPrice ||
        0;
      const availability =
        (variation.quantity ||
          product.quantity ||
          0) > 0
          ? "in stock"
          : "out of stock";

      return `
        <item>
          <g:id>${
            variation.sku || product.sku
          }</g:id>
          <g:title><![CDATA[${title}]]></g:title>
          <g:description><![CDATA[${description}]]></g:description>
          <g:link>${link}</g:link>
          <g:image_link>${image}</g:image_link>
          <g:availability>${availability}</g:availability>
          <g:price>${price.toFixed(
            2
          )} UAH</g:price>
          <g:condition>new</g:condition>
          <g:brand>LEDTech</g:brand>
          <g:product_type>${
            product.category.ua
          }</g:product_type>
          <g:mpn>${
            variation.code ||
            product.code ||
            variation.sku
          }</g:mpn>
          <g:rating>${
            product.averageRating?.toFixed(1) || 0
          }</g:rating>
<g:review_count>${
        product.ratingsCount || 0
      }</g:review_count>

        </item>
      `;
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
    <channel>
      <title>LEDTech XML Feed</title>
      <link>http:// 192.168.0.106:5002</link>
      <description>Асортимент світлодіодної продукції LEDTech</description>
      ${items.join("\n")}
    </channel>
  </rss>`;

  fs.writeFileSync(
    "../client/public/google-feed.xml",
    xml.trim()
  );

  console.log(
    "✅ Файл google-feed.xml згенеровано."
  );
  mongoose.disconnect();
}

generateFeed().catch(console.error);
