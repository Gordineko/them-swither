import amqp from 'amqplib';
import cron from 'node-cron';
import fetch from 'node-fetch';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';

// KeyCRM API config
const API_URL = 'https://openapi.keycrm.app/v1/offers/stocks';
const CRM_TOKEN = 'YzE2NmNjMTI1ODE3ZjdkOTAyY2NjNjU2ODk2NWZhNDkwNmM0ZTA5OQ';

// RabbitMQ config
const RABBIT_URL = 'amqp://admin:Maksimal2003@localhost:5672';
const QUEUE = 'stock_update_trigger';

// Utility: pause between requests to avoid throttling
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch one page of stocks from KeyCRM
async function fetchStockPage(page = 1, limit = 50, skus = []) {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', limit);
  if (skus.length) params.append('filter[offers_sku]', skus.join(','));

  const url = `${API_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CRM_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`KeyCRM API error: ${res.status}`);

  const json = await res.json();
  return json.data || [];
}

// Update stock levels in MongoDB with priority: variation SKU, then top-level SKU
async function updateProductStockInDB({ sku, quantity, reserve }) {
  const available = quantity - reserve;

  // 1) Try updating nested variation by SKU
  const nestedResult = await Product.updateMany(
    { 'variations.variations.sku': sku },
    { $set: { 'variations.variations.$[v].quantity': available } },
    { arrayFilters: [{ 'v.sku': sku }] }
  );

  if (nestedResult.modifiedCount > 0) {
    console.log(
      `SKU ${sku}: nested variations updated to available=${available}. matched=${nestedResult.matchedCount}, modified=${nestedResult.modifiedCount}`
    );
  } else {
    // 2) Fallback: update top-level product SKU
    const topResult = await Product.updateMany(
      { sku: sku },
      { $set: { quantity: available } }
    );
    console.log(
      `SKU ${sku}: top-level updated to available=${available}. matched=${topResult.matchedCount}, modified=${topResult.modifiedCount}`
    );
  }
}

// Process all stock pages
async function processStockUpdates() {
  await connectDB();
  console.log('[STOCK] Connected to DB');

  let page = 1;
  const limit = 50;
  while (true) {
    console.log(`[STOCK] Fetching page ${page}`);
    const stocks = await fetchStockPage(page, limit);
    if (!stocks.length) break;

    for (const record of stocks) {
      try {
        await updateProductStockInDB(record);
      } catch (err) {
        console.error('[STOCK][ERROR] update SKU', record.sku, err);
      }
      await sleep(1200);
    }

    page += 1;
  }

  console.log('[STOCK] All pages processed');
}

// Main: configure RabbitMQ consumer and cron
async function main() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.prefetch(1);

  // Consumer: on trigger, run updates
  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;
      console.log('[RABBIT] Trigger received, updating stocks');
      try {
        await processStockUpdates();
        ch.ack(msg);
      } catch (err) {
        console.error('[RABBIT][ERROR] processing trigger', err);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  // Producer: send initial and scheduled triggers
  const sendTrigger = () => {
    ch.sendToQueue(QUEUE, Buffer.from('run'), { persistent: true });
    console.log('[CRON] Trigger sent', new Date().toISOString());
  };

  sendTrigger();
  cron.schedule('*/10 * * * *', sendTrigger);

  console.log('[INIT] Stock updater initialized');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
