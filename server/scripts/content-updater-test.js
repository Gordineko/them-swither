// scripts/content-updater-test.js
import fetch from 'node-fetch';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';

const API_URL = 'https://openapi.keycrm.app/v1/products';
const CRM_TOKEN = 'YzE2NmNjMTI1ODE3ZjdkOTAyY2NjNjU2ODk2NWZhNDkwNmM0ZTA5OQ';

// --- утилиты ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, opts = {}, { retries = 3, delay = 800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${CRM_TOKEN}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (res.ok) return res.json();
    lastErr = new Error(`HTTP ${res.status}`);
    // на 429/5xx подождём и попробуем ещё
    if ((res.status === 429 || res.status >= 500) && i < retries) {
      await sleep(delay * (i + 1));
      continue;
    }
    throw new Error(`KeyCRM API error: ${res.status}`);
  }
  throw lastErr;
}

function parseCliSkus() {
  const arg = process.argv.find(a => a.startsWith('--sku='));
  if (!arg) return [];
  return (arg.split('=')[1] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function mapImages(attachments = [], thumb) {
  const urls = Array.from(new Set([...(attachments || []), ...(thumb ? [thumb] : [])])).filter(Boolean);
  return urls.map(u => ({ img_link: u, type: 'image' }));
}

async function updateVariationContentInDB(productFromCRM) {
  const { sku, description, attachments_data, thumbnail_url } = productFromCRM || {};
  if (!sku) return;

  const updates = {};
  const imgs = mapImages(attachments_data, thumbnail_url);
  const desc = String(description || '').trim();

  if (desc) {
    updates['variations.variations.$[v].description.ua'] = desc;
    updates['variations.variations.$[v].description.ru'] = desc;
  }
  if (imgs.length) {
    updates['variations.variations.$[v].img'] = imgs;
  }

  if (!Object.keys(updates).length) {
    console.log(`[CONTENT] SKU ${sku}: nothing to update`);
    return;
  }

  const nested = await Product.updateMany(
    { 'variations.variations.sku': sku },
    { $set: updates },
    { arrayFilters: [{ 'v.sku': sku }] }
  );

  if (nested.modifiedCount > 0) {
    console.log(`[CONTENT] SKU ${sku}: variation updated. matched=${nested.matchedCount}, modified=${nested.modifiedCount}`);
  } else {
    console.log(`[CONTENT] SKU ${sku}: no matching variation found`);
  }
}

// --- KeyCRM: постраничная выборка без фильтров на сервере ---
async function fetchProductsPage(page = 1, limit = 50) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const url = `${API_URL}?${params.toString()}`;
  const json = await fetchJson(url);
  return {
    items: Array.isArray(json?.data) ? json.data : [],
    nextUrl: json?.next_page_url || null
  };
}

async function runOnce() {
  const skuFilter = parseCliSkus(); // [] или список SKU для выборочного обновления
  await connectDB();
  console.log('[CONTENT-TEST] Connected to DB');

  let page = 1;
  const limit = 50;

  // если указали SKU — отслеживаем, что уже обновили
  const pending = new Set(skuFilter);

  while (true) {
    console.log(`[CONTENT-TEST] Fetching page ${page}${skuFilter.length ? ` (pending: ${[...pending].join(',')})` : ''}`);
    const { items, nextUrl } = await fetchProductsPage(page, limit);
    if (!items.length) break;

    // если есть фильтр — отсеиваем только нужные SKU на клиенте
    const pageItems = skuFilter.length
      ? items.filter(it => it?.sku && pending.has(String(it.sku)))
      : items;

    for (const item of pageItems) {
      try {
        await updateVariationContentInDB(item);
        if (skuFilter.length) pending.delete(String(item.sku));
      } catch (err) {
        console.error('[CONTENT-TEST][ERROR] update SKU', item?.sku, err);
      }
      await sleep(800); // чуть троттлим
    }

    if (skuFilter.length && pending.size === 0) {
      console.log('[CONTENT-TEST] All requested SKUs processed');
      break;
    }

    if (!nextUrl) break; // страниц больше нет
    page += 1;
  }

  if (skuFilter.length && pending.size > 0) {
    console.warn('[CONTENT-TEST] Not found SKUs:', [...pending].join(', '));
  }

  console.log('[CONTENT-TEST] Finished');
  process.exit(0);
}

runOnce().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
