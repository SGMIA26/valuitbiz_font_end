# ValuitBiz Deploy Guide v2.1

## ⚡ Quick Deploy Checklist

### BƯỚC 1 — Telegram (đã có 1/3 Chat ID)
| Group | Chat ID | Status |
|-------|---------|--------|
| Định Giá (TELEGRAM_CHAT_DINHHGIA) | `-5125879928` | ✅ Đã có |
| Lead Sales (TELEGRAM_CHAT_LEAD) | ??? | ❌ Cần lấy |
| Payment Ops (TELEGRAM_CHAT_PAYMENT) | ??? | ❌ Cần lấy |

**Lấy Chat ID còn thiếu:**
1. Tạo group mới → Add @valuitbiz_notify_bot
2. Gõ "test" trong group  
3. Gọi: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Tìm `"chat":{"id":-XXXXXXXXXX}` → copy số đó

---

### BƯỚC 2 — SePay
| Item | Value | Status |
|------|-------|--------|
| Merchant ID | SP-LIVE-CT5A97B4 | ✅ Đã có |
| API Token | ??? | ❌ Cần lấy |
| Webhook Secret | ??? | ❌ Cần lấy |

**Lấy từ app.sepay.vn:**
- API Token: Cài đặt → Bảo mật → API Token → Generate
- Webhook: Cài đặt → Webhook → Nhập URL → Copy Secret
  - Webhook URL: `https://buildtosell.saigonmia2026.workers.dev/api/webhook-sepay`

---

### BƯỚC 3 — Paddle (thay Stripe)
Đăng ký tại paddle.com (chấp nhận VN entity)
| Item | Status |
|------|--------|
| Vendor ID | ❌ Cần sau khi đăng ký |
| Product ID ($15 USD) | ❌ Tạo product |
| Product ID ($20 USD) | ❌ Tạo product (upsell) |
| Webhook Secret | ❌ Cần setup |

**Webhook Paddle:**
- URL: `https://buildtosell.saigonmia2026.workers.dev/api/webhook-paddle`

---

### BƯỚC 4 — Google Apps Script
1. Mở GSheet: `https://docs.google.com/spreadsheets/d/1KMzRDBsPxv_h4olT-IfvySAsP7hzXLk5_n8yzaPzQgc`
2. Extensions → Apps Script
3. Paste code từ file `valuitbiz_appscript.gs`
4. Run function: `setupValuitBiz()` → cấp quyền
5. Deploy → New Deployment → Web App → Anyone → Deploy
6. Copy **Web App URL** → điền vào GSHEET_WEBAPP_URL

---

### BƯỚC 5 — Deploy Cloudflare Worker
```bash
# Install wrangler (nếu chưa có)
npm install -g wrangler
wrangler login

# Deploy
cd /path/to/valuitbiz
wrangler deploy worker.js --name valuitbiz-worker

# Hoặc paste code thủ công:
# dashboard.cloudflare.com → Workers → Create → paste worker.js
```

---

### BƯỚC 6 — Set Environment Variables
Cloudflare Dashboard → Workers → valuitbiz-worker → Settings → Variables

```
TELEGRAM_BOT_TOKEN        = <bot token>
TELEGRAM_CHAT_DINHHGIA    = -5125879928
TELEGRAM_CHAT_LEAD        = <group 2 id>
TELEGRAM_CHAT_PAYMENT     = <group 3 id>
GSHEET_WEBAPP_URL         = <apps script web app url>
SEPAY_MERCHANT            = SP-LIVE-CT5A97B4
SEPAY_API_TOKEN           = <sepay token>
SEPAY_WEBHOOK_SECRET      = <sepay secret>
PADDLE_VENDOR             = <paddle vendor id>
PADDLE_PRODUCT            = <paddle product id>
PADDLE_WEBHOOK_SECRET     = <paddle secret>
ALLOWED_ORIGIN            = https://valuitbiz.sandboxstartup.vn
```

---

### BƯỚC 7 — Deploy Frontend (index.html)
Upload `index.html` lên hosting của anh tại:
`https://valuitbiz.sandboxstartup.vn/`

---

### BƯỚC 8 — Smoke Test
```
✅ Health check: https://buildtosell.saigonmia2026.workers.dev/health
✅ Mở valuitbiz.sandboxstartup.vn
✅ Chọn segment → điền câu hỏi → tính định giá
✅ Kiểm tra Telegram group Định Giá có nhận thông báo
✅ Điền lead form → kiểm tra Telegram group Lead
✅ Test QR SePay → kiểm tra Telegram group Payment
```

---

## 🗂️ File Structure
```
valuitbiz/
├── index.html          ← Frontend (66KB, 1178 lines)
├── worker.js           ← Cloudflare Worker (304 lines)
├── valuitbiz_appscript.gs ← Google Apps Script
└── DEPLOY.md           ← This file
```

## 📋 Pending (Phase 2)
- [ ] N8N workflow: Payment webhook → Claude API → PDF → Email
- [ ] AI Agent BĐS cross-country compare (upsell $5)
- [ ] SandboxMarket CTA embed trong PDF report
