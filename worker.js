/**
 * ValuitBiz Cloudflare Worker v2.1
 * ─────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/valuation        → Save to GSheet + Telegram #dinhhgia
 *   POST /api/lead             → Save lead + Telegram #lead
 *   POST /api/create-order     → Create SePay/Paddle order
 *   POST /api/webhook-sepay    → SePay callback
 *   POST /api/webhook-paddle   → Paddle webhook
 *   GET  /health               → Health check
 *
 * ENV VARS (Cloudflare Dashboard → Workers → Settings → Variables):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_DINHHGIA     → -5125879928 (Định Giá group)
 *   TELEGRAM_CHAT_LEAD         → (group #2 Chat ID)
 *   TELEGRAM_CHAT_PAYMENT      → (group #3 Chat ID)
 *   GSHEET_WEBAPP_URL          → Apps Script Web App URL
 *   SEPAY_MERCHANT             → SP-LIVE-CT5A97B4
 *   SEPAY_API_TOKEN            → (lấy từ app.sepay.vn)
 *   SEPAY_WEBHOOK_SECRET       → (lấy từ app.sepay.vn)
 *   PADDLE_VENDOR              → (Paddle Vendor ID)
 *   PADDLE_PRODUCT             → (Paddle Product ID)
 *   PADDLE_WEBHOOK_SECRET      → (Paddle secret key)
 *   ALLOWED_ORIGIN             → https://valuitbiz.sandboxstartup.vn
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin':  allowed,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Paddle-Signature',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === '/health') return json({ status: 'ok', version: '2.1', ts: new Date().toISOString() }, cors);
      if (url.pathname === '/api/valuation'      && request.method === 'POST') return handleValuation(request, env, cors);
      if (url.pathname === '/api/lead'           && request.method === 'POST') return handleLead(request, env, cors);
      if (url.pathname === '/api/create-order'   && request.method === 'POST') return handleCreateOrder(request, env, cors);
      if (url.pathname === '/api/webhook-sepay'  && request.method === 'POST') return handleSePay(request, env, cors);
      if (url.pathname === '/api/webhook-paddle' && request.method === 'POST') return handlePaddle(request, env, cors);
      return json({ error: 'Not found' }, cors, 404);
    } catch (e) {
      console.error(e);
      return json({ error: e.message }, cors, 500);
    }
  }
};

// ════════════════════════════════════════════════
//  HANDLERS
// ════════════════════════════════════════════════

/** POST /api/valuation — Save định giá + notify Telegram */
async function handleValuation(request, env, cors) {
  const data = await request.json();

  // Save to GSheet
  await saveGSheet(env, 'valuation', {
    sessionId:    data.sessionId   || '',
    locale:       data.locale      || 'vn',
    segment:      data.segment     || '',
    country:      data.country     || 'Vietnam',
    industry:     data.industry    || '',
    finalValVND:  data.finalValVND || 0,
    finalValUSD:  data.finalValUSD || 0,
    pricePerShare:data.pricePerShare || 0,
    method:       data.method      || '',
    answers:      data.answers     || {},
    ip:           request.headers.get('CF-Connecting-IP') || '',
    ua:           request.headers.get('User-Agent') || '',
  });

  // Telegram notify
  const seg = { idea:'💡 Ý tưởng', startup:'🚀 Startup', sme:'🏢 SME', enterprise:'🏦 Enterprise', realestate:'🏠 BĐS' };
  const msg = [
    `📊 *Định giá mới — ValuitBiz*`,
    `Phân khúc: ${seg[data.segment] || data.segment}`,
    `Quốc gia: ${data.country || 'Vietnam'}`,
    `Ngành: ${data.industry || '—'}`,
    `💰 Kết quả: *${fmtNum(data.finalValVND)} VND*`,
    `   ≈ $${fmtNum(data.finalValUSD)} USD`,
    `📐 Phương pháp: ${data.method || '—'}`,
    `🆔 Session: \`${data.sessionId}\``,
  ].join('\n');
  await telegram(env, env.TELEGRAM_CHAT_DINHHGIA, msg);

  return json({ success: true }, cors);
}

/** POST /api/lead — Save lead info + notify Telegram #lead */
async function handleLead(request, env, cors) {
  const data = await request.json();

  await saveGSheet(env, 'lead', {
    sessionId:    data.sessionId    || '',
    orderId:      data.orderId      || '',
    name:         data.name         || '',
    email:        data.email        || '',
    phone:        data.phone        || '',
    segment:      data.segment      || '',
    country:      data.country      || 'Vietnam',
    finalValVND:  data.finalValVND  || 0,
    finalValUSD:  data.finalValUSD  || 0,
    upsellCompare:data.upsellCompare || false,
    totalBillUSD: data.totalBillUSD || 15,
    paymentMethod:data.paymentMethod || 'SePay',
    note:         '',
  });

  const msg = [
    `🙋 *Lead mới — ValuitBiz*`,
    `👤 ${data.name || '—'} | ${data.email || '—'}`,
    `📱 ${data.phone || '—'}`,
    `Phân khúc: ${data.segment} | ${data.country}`,
    `💰 Định giá: *${fmtNum(data.finalValVND)} VND*`,
    `💳 Thanh toán: ${data.paymentMethod} — $${data.totalBillUSD} USD`,
    data.upsellCompare ? `➕ Upsell: So sánh cross-country (+$5)` : '',
    `🆔 Order: \`${data.orderId}\``,
  ].filter(Boolean).join('\n');
  await telegram(env, env.TELEGRAM_CHAT_LEAD, msg);

  return json({ success: true, orderId: data.orderId }, cors);
}

/** POST /api/create-order — Tạo đơn hàng SePay hoặc Paddle */
async function handleCreateOrder(request, env, cors) {
  const data = await request.json();
  const { gateway, amount, currency, orderId, email, sessionId, upsell } = data;

  if (gateway === 'sepay') {
    // SePay: tạo QR payment request
    const totalVND = Math.round(amount * 25400); // fallback rate
    const desc = `VALUITBIZ ${orderId}`;
    const qrURL = `https://qr.sepay.vn/img?bank=${env.SEPAY_MERCHANT}&amount=${totalVND}&des=${encodeURIComponent(desc)}&template=compact`;
    return json({ success: true, gateway: 'sepay', qrURL, amount: totalVND, currency: 'VND', orderId }, cors);

  } else if (gateway === 'paddle') {
    // Paddle: return checkout URL
    const paddleURL = `https://buy.paddle.com/product/${env.PADDLE_PRODUCT}?email=${encodeURIComponent(email)}&passthrough=${sessionId}&quantity=1`;
    return json({ success: true, gateway: 'paddle', checkoutURL: paddleURL, orderId }, cors);

  } else {
    return json({ error: 'Unknown gateway' }, cors, 400);
  }
}

/** POST /api/webhook-sepay — SePay payment callback */
async function handleSePay(request, env, cors) {
  const body = await request.text();
  const secret = env.SEPAY_WEBHOOK_SECRET || '';

  // Verify SePay signature if secret is set
  if (secret) {
    const sig = request.headers.get('X-Webhook-Secret') || '';
    if (sig !== secret) {
      console.warn('SePay webhook signature mismatch');
      return json({ error: 'Invalid signature' }, cors, 401);
    }
  }

  let data;
  try { data = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, cors, 400); }

  // SePay payload structure: transferContent contains order ref
  const content = (data.transferContent || '').toUpperCase();
  const orderMatch = content.match(/VB-[\w]+/);
  const orderId = orderMatch ? orderMatch[0] : '';
  const amount = data.transferAmount || 0;
  const status = amount > 0 ? 'SUCCESS' : 'FAILED';

  // Save payment
  await saveGSheet(env, 'payment', {
    orderId, sessionId: orderId,
    email: '', segment: '', country: '',
    gateway: 'SePay', currency: 'VND',
    amountLocal: amount, amountUSD: amount / 25400,
    txnId: data.id || data.referenceCode || '',
    status,
    upsell: false,
    payload: data,
  });

  // Update lead status
  if (status === 'SUCCESS') {
    await saveGSheet(env, 'update_lead', { orderId, status: 'PAID', gateway: 'SePay' });
  }

  // Telegram #payment
  const emoji = status === 'SUCCESS' ? '✅' : '❌';
  const msg = [
    `${emoji} *Thanh toán SePay*`,
    `OrderID: \`${orderId}\``,
    `Số tiền: *${fmtNum(amount)} VND*`,
    `Status: *${status}*`,
    `Ref: ${data.referenceCode || data.id || '—'}`,
    `Nội dung: ${data.transferContent || '—'}`,
  ].join('\n');
  await telegram(env, env.TELEGRAM_CHAT_PAYMENT, msg);

  return json({ success: true }, cors);
}

/** POST /api/webhook-paddle — Paddle payment webhook */
async function handlePaddle(request, env, cors) {
  const body = await request.text();

  // Parse Paddle webhook (form-encoded or JSON depending on version)
  let data = {};
  try {
    data = JSON.parse(body);
  } catch {
    // Paddle classic sends form-encoded
    const params = new URLSearchParams(body);
    for (const [k, v] of params) data[k] = v;
  }

  const alertName = data.alert_name || data.event_type || '';
  const passthrough = data.passthrough || data.custom_data?.passthrough || '';
  const orderId = passthrough || '';
  const email = data.email || data.customer?.email || '';
  const amountUSD = parseFloat(data.sale_gross || data.earnings || data.amount || 0);
  const status = (alertName.includes('payment_succeeded') || alertName === 'subscription_payment_succeeded') ? 'SUCCESS' : 'PENDING';

  if (status === 'SUCCESS') {
    await saveGSheet(env, 'payment', {
      orderId, sessionId: orderId, email,
      segment: '', country: '',
      gateway: 'Paddle', currency: 'USD',
      amountLocal: amountUSD, amountUSD,
      txnId: data.order_id || data.subscription_id || '',
      status: 'SUCCESS',
      upsell: amountUSD >= 20,
      payload: data,
    });
    await saveGSheet(env, 'update_lead', { orderId, status: 'PAID', gateway: 'Paddle' });

    const msg = [
      `✅ *Thanh toán Paddle*`,
      `OrderID: \`${orderId}\``,
      `Email: ${email}`,
      `Số tiền: *$${amountUSD} USD*`,
      `Event: ${alertName}`,
    ].join('\n');
    await telegram(env, env.TELEGRAM_CHAT_PAYMENT, msg);
  }

  return json({ success: true }, cors);
}

// ════════════════════════════════════════════════
//  GOOGLE SHEETS — via Apps Script Web App
// ════════════════════════════════════════════════
async function saveGSheet(env, action, data) {
  const url = env.GSHEET_WEBAPP_URL;
  if (!url || url === 'YOUR_GSHEET_WEBAPP_URL') {
    console.warn('GSHEET_WEBAPP_URL not configured — skipping GSheet save');
    return;
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    const result = await r.json();
    if (!result.success) console.warn('GSheet error:', result.error);
  } catch (e) {
    console.error('GSheet save failed:', e.message);
  }
}

// ════════════════════════════════════════════════
//  TELEGRAM
// ════════════════════════════════════════════════
async function telegram(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) { console.warn('Telegram not configured'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) { console.error('Telegram error:', e.message); }
}

// ════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════
function json(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
function fmtNum(n) {
  if (!n) return '0';
  return parseFloat(n).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}
