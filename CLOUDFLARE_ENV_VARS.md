# Cloudflare Worker — Environment Variables
## Vào: dash.cloudflare.com → Workers → buildtosell → Settings → Variables

| Variable Name              | Value                                                              |
|----------------------------|--------------------------------------------------------------------|
| ALLOWED_ORIGIN             | https://valuitbiz.sandboxstartup.vn                               |
| TELEGRAM_BOT_TOKEN         | [Bot Token của @valuitbiz_notify_bot]                             |
| TELEGRAM_CHAT_DINHHGIA     | -5125879928                                                        |
| TELEGRAM_CHAT_LEAD         | -5247556131                                                        |
| TELEGRAM_CHAT_PAYMENT      | -5271001547                                                        |
| SEPAY_MERCHANT             | SP-LIVE-CT5A97B4                                                   |
| SEPAY_API_TOKEN            | KUFJ9QAX67L0L2CXKHERFSZRYAIN4US7RQD35OJER2ZM0ZSWN6ODB4KIOPBPHDCG |
| SEPAY_WEBHOOK_SECRET       | [Lấy từ app.sepay.vn sau khi tạo webhook]                         |
| GSHEET_WEBAPP_URL          | [Apps Script Web App URL — sau khi deploy Apps Script]            |
| PADDLE_PRODUCT             | [Price ID từ Paddle Catalog — dạng pri_xxx]                       |
| PADDLE_WEBHOOK_SECRET      | [Paddle webhook secret — sau khi approve]                         |

## Cloudflare Pages — Upload files:
Files cần upload lên Pages (thư mục gốc):
- index.html
- pricing.html
- terms.html
- privacy.html
- _redirects
- _headers

## Worker URL:
https://buildtosell.saigonmia2026.workers.dev

## SePay Webhook URL (điền vào app.sepay.vn):
https://buildtosell.saigonmia2026.workers.dev/api/webhook-sepay
