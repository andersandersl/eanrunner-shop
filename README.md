# WebVersion

This is an isolated public-safe implementation for EANrunner.

## Scope

- Public catalog only shows:
  - `in stock` or `not in stock`
  - margin indicator `A-F` (`N/A` fallback)
  - one Prisjakt link
- Public API/UI never expose supplier names or exact prices.
- Users can request supplier+exact pricing by email.

## Folders

- `web/` React + Vite frontend
- `api/` Express + TypeScript backend

## Quick Start

1. Copy env templates:
   - `copy web/.env.example web/.env`
   - `copy api/.env.example api/.env`
2. Set Firebase credentials in `api/.env`.
3. Start API:
   - `npm --prefix api run dev`
4. Start web:
   - `npm --prefix web run dev`

## API Endpoints

- `GET /health`
- `GET /api/public/products?query=&limit=`
- `GET /api/public/products/:ean`
- `POST /api/public/request-supplier-price`

## Notes

- This implementation does not modify the original project.
- Email sending uses Resend when `RESEND_API_KEY` is set.
- Requests are always logged in Firestore (`REQUESTS_COLLECTION`).
- Azure App Service cutover notes: `AZURE_CUTOVER.md`
- Google Cloud Run cutover notes: `CLOUD_RUN_CUTOVER.md`
