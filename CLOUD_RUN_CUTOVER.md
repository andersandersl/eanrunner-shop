# Google Cloud Run Cutover

## Goal
Move the public API from Railway to Google Cloud Run with one fixed outbound IP approved in Azure SQL.

## Why this setup
- Cloud Run runs the current Express API with minimal code change.
- A Serverless VPC Access connector plus Cloud NAT gives a stable egress IP.
- Azure SQL firewall only needs that one IP allowlisted.
- Frontend can stay on Vercel.

## Target architecture
- `web/` stays on Vercel
- `api/` runs on Cloud Run
- Cloud Run egress goes through:
  - Serverless VPC Access connector
  - VPC network
  - Cloud Router
  - Cloud NAT
  - reserved static external IP
- Azure SQL firewall allowlists the reserved static IP

## 1) Prepare Google Cloud
1. Create or choose a GCP project.
2. Enable these APIs:
   - Cloud Run Admin API
   - Cloud Build API
   - Artifact Registry API
   - Serverless VPC Access API
   - Compute Engine API
3. Create an Artifact Registry Docker repository.

## 2) Reserve one static outbound IP
1. VPC network -> IP addresses.
2. Reserve external static address.
3. Name example: `eanrunner-api-egress-ip`.
4. Keep this IP; it is the one Azure SQL should approve.

## 3) Create VPC egress path
1. Create or choose a VPC network.
2. Create a subnet for serverless connector if needed.
3. Create Serverless VPC Access connector.
4. Create Cloud Router.
5. Create Cloud NAT:
   - attach the router
   - choose manual IP allocation
   - assign the reserved static IP

## 4) Approve the static IP in Azure SQL
1. Give the reserved static IP to whoever manages Azure SQL.
2. Ask them to add a firewall rule for that exact IP.
3. Wait for firewall propagation.

## 5) Create Cloud Run service
1. Service name example: `eanrunner-shop-api`.
2. Region: choose one close to your SQL region/users.
3. Source: deploy from container image.
4. Container port: `8080`.
5. Authentication: allow unauthenticated.
6. Networking:
   - attach the Serverless VPC Access connector
   - egress: `All traffic`

## 6) Configure Cloud Run environment variables
Set these in Cloud Run service variables:
- `WEB_ORIGIN=https://eanrunner-shop.vercel.app,https://shop.eanrunner.com`
- `SQL_SERVER=eanrunner-sql.database.windows.net`
- `SQL_DATABASE=eanrunner-db`
- `SQL_USER=<sql user>`
- `SQL_PASSWORD=<sql password>`
- `RESEND_API_KEY=<optional>`
- `REQUEST_FROM_EMAIL=<optional>`
- `REQUEST_INTERNAL_EMAIL=<optional>`

Notes:
- Do not set `PORT`; Cloud Run injects it.
- The API already reads `process.env.PORT` and the Dockerfile exposes `8080`.

## 7) GitHub Actions deployment secrets
Add these GitHub Actions secrets:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_ARTIFACT_REGISTRY_REPO`
- `GCP_CLOUD_RUN_SERVICE`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

## 8) Deploy flow
1. Push to `master` touching `api/**`, or run workflow manually.
2. Workflow builds the `api/` container.
3. Workflow pushes image to Artifact Registry.
4. Workflow deploys image to Cloud Run.

## 9) Validate API before frontend cutover
Test these endpoints on the Cloud Run URL:
- `/health`
- `/api/public/stats`
- `/api/public/products?market=dk&limit=1&page=1`

Expected outcome:
- `/health` returns `db: up` once SQL firewall includes the static IP.
- stats/products return `200`.

## 10) Switch frontend
In Vercel set:
- `VITE_API_BASE_URL=https://<your-cloud-run-url>`

Redeploy frontend.

## 11) Rollback
1. Change `VITE_API_BASE_URL` back to previous API URL.
2. Redeploy frontend.

## 12) Cost/complexity note
- Cloud Run alone is cheap and simple.
- Fixed egress requires the extra VPC/NAT pieces.
- This is still materially safer for your use case than a platform with rotating shared outbound IPs.