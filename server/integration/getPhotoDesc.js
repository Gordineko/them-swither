// scripts/content-updater.js
import amqp from 'amqplib';
import cron from 'node-cron';
import fetch from 'node-fetch';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';

// === KeyCRM API ===
const API_URL = 'https://openapi.keycrm.app/v1/products';
const CRM_TOKEN = 'YzE2NmNjMTI1ODE3ZjdkOTAyY2NjNjU2ODk2NWZhNDkwNmM0ZTA5OQ';

// === RabbitMQ ===
const RABBIT_URL = 'amqp://admin:Maksimal2003@localhost:5672';
const QUEUE = 'content_update_trigger';

// === Utils ===
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url, opts = {}, { retries = 3, delay = 1200 } = {}) {
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
    if ((res.status === 429 || res.status >= 500) && i < retries) {
      await sleep(delay * (i + 1));
      continue;
    }
    throw new Error(`KeyCRM API error: ${res.status}`);
  }
  throw lastErr;
}

function mapImages(attachments = [], thumb) {
  const urls = Array.from(new Set([...(attachments || []), ...(thumb ? [thumb] : [])]))
    .filter(Boolean);
  return urls.map(u => ({ img_link: u, type: 'image' }));
}

async function updateVariationContentInDB(productFromCRM) {
  const { sku, description, attachments_data, thumbnail_url } = productFromCRM || {};
  if (!sku) return;

  const updates = {};
  const imgs = mapImages(attachments_data, thumbnail_url);
  const desc = String(description || '').trim();

  // Только непустые поля включаем в апдейт:
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

async function fetchProductsPage(page = 1, limit = 50) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const url = `${API_URL}?${params.toString()}`;
  const json = await fetchJson(url);
  return {
    items: Array.isArray(json?.data) ? json.data : [],
    nextUrl: json?.next_page_url || null
  };
}

// ---- Main worker ----
async function processContentUpdates({ skus = [] } = {}) {
  await connectDB();
  console.log('[CONTENT] Connected to DB');

  let page = 1;
  const limit = 50;

  const pending = new Set((skus || []).map(s => String(s)));

  while (true) {
    const tag = pending.size ? ` (pending: ${[...pending].join(',')})` : '';
    console.log(`[CONTENT] Fetching page ${page}${tag}`);
    const { items, nextUrl } = await fetchProductsPage(page, limit);
    if (!items.length) break;

    const pageItems = pending.size
      ? items.filter(it => it?.sku && pending.has(String(it.sku)))
      : items;

    for (const item of pageItems) {
      try {
        await updateVariationContentInDB(item);
        if (pending.size) pending.delete(String(item.sku));
      } catch (err) {
        console.error('[CONTENT][ERROR] update SKU', item?.sku, err);
      }
      await sleep(800);
    }

    if (pending.size === 0) {
      if (skus.length) console.log('[CONTENT] All requested SKUs processed');
      break;
    }

    if (!nextUrl) break;
    page += 1;
  }

  if (pending.size > 0) {
    console.warn('[CONTENT] Not found SKUs:', [...pending].join(', '));
  }

  console.log('[CONTENT] All pages processed');
}

// ---- Rabbit/cron wiring ----
async function main() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.prefetch(1);

  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;
      let payload = {};
      try {
        const txt = msg.content?.toString?.() || '';
        // Поддерживаем два формата: "run" и JSON {"skus":["A","B"]}
        if (txt && txt.trim().startsWith('{')) {
          payload = JSON.parse(txt);
        }
      } catch (e) {
        console.warn('[RABBIT] Non-JSON message, will run full sync');
      }

      const skus = Array.isArray(payload.skus)
        ? payload.skus.map(String).filter(Boolean)
        : [];

      console.log(
        skus.length
          ? `[RABBIT] Trigger received: targeted update for ${skus.length} SKU(s)`
          : '[RABBIT] Trigger received: full content update'
      );

      try {
        await processContentUpdates({ skus });
        ch.ack(msg);
      } catch (err) {
        console.error('[RABBIT][ERROR] processing trigger', err);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  const sendTrigger = (body = 'run') => {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    ch.sendToQueue(QUEUE, buf, { persistent: true });
    console.log('[CRON] Trigger sent', new Date().toISOString(), typeof body === 'string' ? '' : '(targeted)');
  };

  // Разовый запуск при старте — полный
  sendTrigger();
  // Каждые 10 минут — полный
  cron.schedule('*/10 * * * *', () => sendTrigger());

  console.log('[INIT] Content updater initialized');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
