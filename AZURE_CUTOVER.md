# Azure API Cutover (Railway -> App Service)

## Goal
Move API hosting from Railway to Azure App Service so Azure SQL firewall can use stable App Service outbound IPs.

## Current Repo Readiness
- API workflow already exists: `.github/workflows/deploy-api.yml`
- API builds with `npm --prefix api run build`

## 1) Create Azure App Service
1. Azure Portal -> Create Resource -> Web App.
2. Name: choose a unique app (example: `eanrunner-shop-api`).
3. Runtime stack: Node 22 LTS.
4. OS: Windows (compatible with existing `api/web.config`) or Linux.
5. Region: same region as SQL if possible.

## 2) Configure App Service startup/runtime
1. App Service -> Configuration -> General settings.
2. Ensure runtime is Node 22.
3. Startup command:
   - If Linux: `node dist/server.js`
   - If Windows with iisnode + web.config: leave default.

## 3) Configure App Service environment variables
App Service -> Configuration -> Application settings:
- `PORT` = `8080` (optional; platform also injects one)
- `WEB_ORIGIN` = `https://eanrunner-shop.vercel.app,https://shop.eanrunner.com`
- `SQL_SERVER` = `eanrunner-sql.database.windows.net`
- `SQL_DATABASE` = `eanrunner-db`
- `SQL_USER` = your SQL user
- `SQL_PASSWORD` = your SQL password
- `RESEND_API_KEY` = your resend key (if used)
- `REQUEST_FROM_EMAIL` = sender value (if used)
- `REQUEST_INTERNAL_EMAIL` = recipient value (if used)

## 4) Configure Azure SQL firewall (stable)
1. SQL Server -> Networking -> Firewalls and virtual networks.
2. Add all App Service outbound IPs from:
   - App Service -> Properties -> Outbound IP Addresses
   - Also add `Additional Outbound IP Addresses` if present.
3. Save and wait 5 minutes.

## 5) Wire GitHub Actions deploy secrets
In GitHub repo `andersandersl/eanrunner-shop` -> Settings -> Secrets and variables -> Actions:
- `AZURE_WEBAPP_NAME` = your App Service name
- `AZURE_WEBAPP_PUBLISH_PROFILE` = publish profile XML from App Service -> Get publish profile

## 6) Deploy API
1. Push to `master` touching `api/**` or `.github/workflows/deploy-api.yml`.
2. Confirm workflow succeeds in Actions.
3. Test:
   - `/health`
   - `/api/public/stats`
   - `/api/public/products?market=dk&limit=1&page=1`

## 7) Switch frontend to Azure API
Vercel project env var:
- `VITE_API_BASE_URL` = `https://<your-app-service>.azurewebsites.net`

Redeploy frontend after env change.

## 8) Cutover verification
1. Open catalog page and verify no 500 errors.
2. Check API logs in App Service Log stream.
3. Keep Railway running for rollback window (24-48h).

## 9) Rollback plan
If needed:
1. Revert `VITE_API_BASE_URL` in Vercel to Railway URL.
2. Redeploy frontend.

## Optional Hardening (next phase)
1. Move SQL to private endpoint + App Service VNet integration.
2. Disable public SQL access.
3. Store secrets in Azure Key Vault.
