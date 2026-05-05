import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import sql from 'mssql';
import { Resend } from 'resend';
import { z } from 'zod';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
const WEB_ORIGINS = WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const REQUEST_FROM_EMAIL = process.env.REQUEST_FROM_EMAIL || 'EANrunner <notifications@eanrunner.com>';
const REQUEST_INTERNAL_EMAIL = process.env.REQUEST_INTERNAL_EMAIL || '';

const sqlConfig: sql.config = {
  server: process.env.SQL_SERVER || 'eanrunner-sql.database.windows.net',
  database: process.env.SQL_DATABASE || 'eanrunner-db',
  user: process.env.SQL_USER || '',
  password: process.env.SQL_PASSWORD || '',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

type PublicProduct = {
  ean: string;
  title: string;
  brand: string;
  category: string;
  image: string | null;
  stockStatus: 'in stock' | 'not in stock';
  marginGrade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'N/A';
  competitorCount: number;
  marketPrice: number | null;
  marketCurrency: string | null;
  cheapestMarketLink: string | null;
  updatedAt: string | null;
};

type InternalSupplierDetail = {
  supplier: string;
  stock: number;
  unitPrice: number;
};

type ProductRow = {
  ean: string;
  title: string | null;
  brand: string | null;
  category: string | null;
  main_image: string | null;
  enriched_at: Date | null;
  cheapest_supplier_price_eur: number | null;
  total_stock: number | null;
  competitor_count: number | null;
  market_price_local: number | null;
  market_currency: string | null;
  market_price_eur: number | null;
  market_url: string | null;
};

type CategoryRow = {
  category: string;
  product_count: number;
};

type BrandByCategoryRow = {
  category: string;
  brand: string;
};

type SupplierRow = {
  supplier_code: string;
  display_name: string | null;
  stock_quantity: number;
  price_eur: number;
};

const ALLOWED_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'N/A']);

const searchQuerySchema = z.object({
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  page: z.coerce.number().min(1).optional(),
  category: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  market: z.enum(['dk', 'se', 'fi']).optional(),
  grades: z.string().trim().max(40).optional(), // comma-separated e.g. "A,B,C"
});

function computeMarginGrade(cheapestSupplierPrice: number | null, marketPriceEur: number | null): PublicProduct['marginGrade'] {
  if (!cheapestSupplierPrice || !marketPriceEur || cheapestSupplierPrice <= 0 || marketPriceEur <= 0) {
    return 'N/A';
  }
  const pct = ((marketPriceEur - cheapestSupplierPrice) / marketPriceEur) * 100;
  if (pct < -10) return 'F';
  if (pct < 0) return 'E';
  if (pct < 5) return 'D';
  if (pct < 10) return 'C';
  if (pct < 20) return 'B';
  return 'A';
}

const requestSupplierSchema = z.object({
  ean: z.string().trim().min(5).max(32),
  email: z.string().trim().email(),
  sourcePage: z.string().trim().max(200).optional(),
});

const emailCooldownByEmail = new Map<string, number>();

function buildRequesterEmailHtml(payload: {
  ean: string;
  title: string;
  supplierRows: InternalSupplierDetail[];
}): string {
  const rows = payload.supplierRows
    .map((row) => `<li><strong>${row.supplier}</strong>: EUR ${row.unitPrice.toFixed(2)} (${row.stock} in stock)</li>`)
    .join('');

  return `
    <h2>Supplier details for ${payload.title || payload.ean}</h2>
    <p>Requested EAN: <strong>${payload.ean}</strong></p>
    <p>Requested supplier prices:</p>
    <ul>${rows || '<li>No in-stock supplier price found.</li>'}</ul>
  `;
}

function buildInternalEmailHtml(payload: {
  ean: string;
  email: string;
  sourcePage: string;
  title: string;
  supplierRows: InternalSupplierDetail[];
}): string {
  const rows = payload.supplierRows
    .map((row) => `<li><strong>${row.supplier}</strong>: EUR ${row.unitPrice.toFixed(2)} (${row.stock} in stock)</li>`)
    .join('');

  return `
    <h2>New supplier price request</h2>
    <p><strong>Requester:</strong> ${payload.email}</p>
    <p><strong>EAN:</strong> ${payload.ean}</p>
    <p><strong>Product:</strong> ${payload.title || 'Unknown title'}</p>
    <p><strong>Source page:</strong> ${payload.sourcePage || '-'}</p>
    <p><strong>Supplier rows:</strong></p>
    <ul>${rows || '<li>No in-stock supplier price found.</li>'}</ul>
  `;
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig)
      .then((pool) => {
        console.log('Connected to Azure SQL');
        return pool;
      })
      .catch((err) => {
        // Allow retries on the next request if first connection attempt fails.
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

async function main(): Promise<void> {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (WEB_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'webversion-api' });
  });

  app.get('/api/public/products', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const limit = parsed.data.limit ?? 48;
    const page = parsed.data.page ?? 1;
    const offset = (page - 1) * limit;
    const rawQuery = (parsed.data.query || '').trim();
    const rawCategory = (parsed.data.category || '').trim();
    const rawBrand = (parsed.data.brand || '').trim();
    const market = parsed.data.market ?? 'dk';
    // Validate and build grade filter — values are from a known safe set
    const gradesParam = (parsed.data.grades || '').trim();
    const activeGrades = gradesParam
      ? gradesParam.split(',').map((g) => g.trim()).filter((g) => ALLOWED_GRADES.has(g))
      : [];
    // Build SQL-safe IN list — values are from ALLOWED_GRADES only
    const gradeInList = activeGrades.map((g) => `'${g}'`).join(',');
    const gradeWhereClause = activeGrades.length > 0 ? `WHERE margin_grade IN (${gradeInList})` : '';

    // Shared CTE for grade computation
    const gradeCte = `
      WITH all_products AS (
        SELECT ep.ean, ep.title, ep.brand, ep.category, ep.main_image, ep.enriched_at
        FROM enriched.product ep ${/* whereClause injected below */ ''}
      ),
      with_prices AS (
        SELECT
          ap.ean, ap.title, ap.brand, ap.category, ap.main_image, ap.enriched_at,
          MIN(csp.price_eur) AS cheapest_supplier_price_eur,
          SUM(ISNULL(csp.stock_quantity, 0)) AS total_stock,
          COALESCE(emp.offer_count, 0) AS competitor_count,
          emp.lowest_price AS market_price_local,
          emp.currency AS market_currency,
          CASE WHEN emp.currency = 'EUR' THEN COALESCE(emp.lowest_price_eur, emp.lowest_price) ELSE emp.lowest_price_eur END AS market_price_eur,
          emp.product_url AS market_url
        FROM all_products ap
        LEFT JOIN consolidated.supplier_product csp ON csp.ean = ap.ean AND csp.stock_quantity > 0
        LEFT JOIN enriched.market_price emp ON emp.ean = ap.ean AND emp.country = @market
        GROUP BY ap.ean, ap.title, ap.brand, ap.category, ap.main_image, ap.enriched_at,
                 emp.lowest_price, emp.currency, emp.lowest_price_eur, emp.product_url
      ),
      with_grades AS (
        SELECT *,
          CASE
            WHEN cheapest_supplier_price_eur IS NULL OR market_price_eur IS NULL
              OR cheapest_supplier_price_eur <= 0 OR market_price_eur <= 0 THEN 'N/A'
            WHEN ((market_price_eur - cheapest_supplier_price_eur) / market_price_eur) * 100 < -10 THEN 'F'
            WHEN ((market_price_eur - cheapest_supplier_price_eur) / market_price_eur) * 100 < 0 THEN 'E'
            WHEN ((market_price_eur - cheapest_supplier_price_eur) / market_price_eur) * 100 < 5 THEN 'D'
            WHEN ((market_price_eur - cheapest_supplier_price_eur) / market_price_eur) * 100 < 10 THEN 'C'
            WHEN ((market_price_eur - cheapest_supplier_price_eur) / market_price_eur) * 100 < 20 THEN 'B'
            ELSE 'A'
          END AS margin_grade
        FROM with_prices
      )
    `;

    try {
      const pool = await getPool();
      const request = pool.request();
      request.input('limit', sql.Int, limit);
      request.input('offset', sql.Int, offset);
      request.input('market', sql.VarChar, market);

      const conditions: string[] = [];
      if (rawQuery) {
        request.input('query', sql.NVarChar, `%${rawQuery}%`);
        conditions.push('(ep.ean LIKE @query OR ep.title LIKE @query OR ep.brand LIKE @query)');
      }
      if (rawCategory) {
        request.input('category', sql.NVarChar, rawCategory);
        conditions.push('ep.category = @category');
      }
      if (rawBrand) {
        request.input('brand', sql.NVarChar, rawBrand);
        conditions.push('ep.brand = @brand');
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total: number;
      let result: sql.IResult<unknown>;

      if (activeGrades.length > 0) {
        // Grade-filtered path: compute grades in SQL, filter, then paginate
        const countRequest = pool.request();
        if (rawQuery) countRequest.input('query', sql.NVarChar, `%${rawQuery}%`);
        if (rawCategory) countRequest.input('category', sql.NVarChar, rawCategory);
        if (rawBrand) countRequest.input('brand', sql.NVarChar, rawBrand);
        countRequest.input('market', sql.VarChar, market);
        const countCte = gradeCte.replace(
          'FROM enriched.product ep ',
          `FROM enriched.product ep ${whereClause} `,
        );
        const countResult = await countRequest.query(`
          ${countCte}
          SELECT COUNT(*) AS total FROM with_grades ${gradeWhereClause}
        `);
        total = countResult.recordset[0]?.total ?? 0;

        const dataCte = gradeCte.replace(
          'FROM enriched.product ep ',
          `FROM enriched.product ep ${whereClause} `,
        );
        result = await request.query(`
          ${dataCte}
          SELECT * FROM with_grades
          ${gradeWhereClause}
          ORDER BY competitor_count DESC, CASE WHEN margin_grade = 'N/A' THEN 1 ELSE 0 END, enriched_at DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
      } else {
        // Fast path: no grade filter
        const countRequest = pool.request();
        if (rawQuery) countRequest.input('query', sql.NVarChar, `%${rawQuery}%`);
        if (rawCategory) countRequest.input('category', sql.NVarChar, rawCategory);
        if (rawBrand) countRequest.input('brand', sql.NVarChar, rawBrand);
        const countResult = await countRequest.query(`
          SELECT COUNT(*) AS total FROM enriched.product ep ${whereClause}
        `);
        total = countResult.recordset[0]?.total ?? 0;

        result = await request.query(`
          WITH top_products AS (
            SELECT
              ep.ean, ep.title, ep.brand, ep.category, ep.main_image, ep.enriched_at,
              COALESCE(emp.offer_count, 0) AS competitor_count
            FROM enriched.product ep
            LEFT JOIN enriched.market_price emp ON emp.ean = ep.ean AND emp.country = @market
            ${whereClause}
            ORDER BY COALESCE(emp.offer_count, 0) DESC, ep.enriched_at DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
          )
          SELECT
            tp.ean, tp.title, tp.brand, tp.category, tp.main_image, tp.enriched_at,
            MIN(csp.price_eur) AS cheapest_supplier_price_eur,
            SUM(ISNULL(csp.stock_quantity, 0)) AS total_stock,
            tp.competitor_count,
            emp.lowest_price AS market_price_local,
            emp.currency AS market_currency,
            CASE WHEN emp.currency = 'EUR' THEN COALESCE(emp.lowest_price_eur, emp.lowest_price) ELSE emp.lowest_price_eur END AS market_price_eur,
            emp.product_url AS market_url
          FROM top_products tp
          LEFT JOIN consolidated.supplier_product csp ON csp.ean = tp.ean AND csp.stock_quantity > 0
          LEFT JOIN enriched.market_price emp ON emp.ean = tp.ean AND emp.country = @market
          GROUP BY tp.ean, tp.title, tp.brand, tp.category, tp.main_image, tp.enriched_at,
                   tp.competitor_count, emp.lowest_price, emp.currency, emp.lowest_price_eur, emp.product_url
          ORDER BY competitor_count DESC, tp.enriched_at DESC
        `);
      }

      const products: PublicProduct[] = (result.recordset as ProductRow[]).map((row) => ({
        ean: row.ean,
        title: row.title || '',
        brand: row.brand || '',
        category: row.category || '',
        image: row.main_image || null,
        stockStatus: (row.total_stock ?? 0) > 0 ? 'in stock' : 'not in stock',
        marginGrade: computeMarginGrade(row.cheapest_supplier_price_eur, row.market_price_eur),
        competitorCount: row.competitor_count ?? 0,
        marketPrice: row.market_price_local ?? null,
        marketCurrency: row.market_currency ?? null,
        cheapestMarketLink: row.market_url || null,
        updatedAt: row.enriched_at ? new Date(row.enriched_at).toISOString() : null,
      }));

      res.json({ products, count: products.length, total });
    } catch (err) {
      console.error('Error fetching products', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/products/:ean', async (req, res) => {
    const ean = (req.params.ean || '').trim();
    if (!ean) {
      res.status(400).json({ error: 'Missing EAN' });
      return;
    }

    try {
      const pool = await getPool();
      const request = pool.request();
      request.input('ean', sql.NVarChar, ean);

      const result = await request.query(`
        SELECT
          ep.ean,
          ep.title,
          ep.brand,
          ep.main_image,
          ep.enriched_at,
          MIN(csp.price_eur) AS cheapest_supplier_price_eur,
          SUM(ISNULL(csp.stock_quantity, 0)) AS total_stock,
          emp.lowest_price AS market_price_local,
          emp.currency AS market_currency,
          CASE WHEN emp.currency = 'EUR' THEN COALESCE(emp.lowest_price_eur, emp.lowest_price) ELSE emp.lowest_price_eur END AS market_price_eur,
          emp.product_url AS market_url
        FROM enriched.product ep
        LEFT JOIN consolidated.supplier_product csp ON csp.ean = ep.ean AND csp.stock_quantity > 0
        LEFT JOIN enriched.market_price emp ON emp.ean = ep.ean AND emp.country = 'dk'
        WHERE ep.ean = @ean
        GROUP BY ep.ean, ep.title, ep.brand, ep.main_image, ep.enriched_at, emp.lowest_price, emp.currency, emp.lowest_price_eur, emp.product_url
      `);

      if (result.recordset.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const row = result.recordset[0] as ProductRow;
      res.json({
        product: {
          ean: row.ean,
          title: row.title || '',
          brand: row.brand || '',
          image: row.main_image || null,
          stockStatus: (row.total_stock ?? 0) > 0 ? 'in stock' : 'not in stock',
          marginGrade: computeMarginGrade(row.cheapest_supplier_price_eur, row.market_price_eur),
          competitorCount: 0,
          marketPrice: row.market_price_local ?? null,
          marketCurrency: row.market_currency ?? null,
          cheapestMarketLink: row.market_url || null,
          updatedAt: row.enriched_at ? new Date(row.enriched_at).toISOString() : null,
        } as PublicProduct,
      });
    } catch (err) {
      console.error('Error fetching product', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Full product detail (for product page) ──────────────────────────────
  app.get('/api/public/products/:ean/detail', async (req, res) => {
    const ean = (req.params.ean || '').trim();
    if (!ean) { res.status(400).json({ error: 'Missing EAN' }); return; }

    try {
      const pool = await getPool();
      const request = pool.request();
      request.input('ean', sql.NVarChar, ean);

      const [prodResult, transResult, stockResult] = await Promise.all([
        request.query(`
          SELECT
            ep.ean, ep.title, ep.brand, ep.description, ep.category,
            ep.images_json, ep.main_image,
            ep.weight_g, ep.width_mm, ep.height_mm, ep.depth_mm,
            ep.attributes_flat_json, ep.mpn, ep.model, ep.color,
            ep.country_of_origin, ep.enriched_at
          FROM enriched.product ep
          WHERE ep.ean = @ean
        `),
        pool.request().input('ean', sql.NVarChar, ean).query(`
          SELECT language_code, title, description, translation_status
          FROM enriched.product_translation
          WHERE ean = @ean
          ORDER BY language_code
        `),
        pool.request().input('ean', sql.NVarChar, ean).query(`
          SELECT COUNT(DISTINCT supplier_code) AS supplier_count,
                 SUM(stock_quantity) AS total_stock
          FROM consolidated.supplier_product
          WHERE ean = @ean AND stock_quantity > 0
        `),
      ]);

      if (prodResult.recordset.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const p = prodResult.recordset[0];
      const stockRow = stockResult.recordset[0];

      let images: string[] = [];
      try { images = JSON.parse(p.images_json || '[]'); } catch { images = []; }
      if (p.main_image && !images.includes(p.main_image)) images.unshift(p.main_image);

      let attributeGroups: Record<string, Record<string, string>> = {};
      try { attributeGroups = JSON.parse(p.attributes_flat_json || '{}'); } catch { attributeGroups = {}; }

      const translations = transResult.recordset.map((t: { language_code: string; title: string | null; description: string | null; translation_status: string }) => ({
        languageCode: t.language_code,
        title: t.title || null,
        description: t.description || null,
        status: t.translation_status,
      }));

      res.json({
        ean: p.ean,
        title: p.title || '',
        brand: p.brand || '',
        description: p.description || null,
        category: p.category || '',
        images,
        mpn: p.mpn || null,
        model: p.model || null,
        color: p.color || null,
        countryOfOrigin: p.country_of_origin || null,
        dimensions: {
          weightG: p.weight_g ?? null,
          widthMm: p.width_mm ?? null,
          heightMm: p.height_mm ?? null,
          depthMm: p.depth_mm ?? null,
        },
        attributeGroups,
        translations,
        supplierCount: stockRow?.supplier_count ?? 0,
        totalStock: stockRow?.total_stock ?? 0,
        enrichedAt: p.enriched_at ? new Date(p.enriched_at).toISOString() : null,
      });
    } catch (err) {
      console.error('Error fetching product detail', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/public/request-supplier-price', async (req, res) => {
    const parsed = requestSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const payload = parsed.data;
    const normalizedEmail = payload.email.toLowerCase();
    const now = Date.now();

    const lastRequest = emailCooldownByEmail.get(normalizedEmail) || 0;
    if (now - lastRequest < 60_000) {
      res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      return;
    }
    emailCooldownByEmail.set(normalizedEmail, now);

    try {
      const pool = await getPool();
      const productRequest = pool.request();
      productRequest.input('ean', sql.NVarChar, payload.ean);
      const productResult = await productRequest.query(`
        SELECT title FROM enriched.product WHERE ean = @ean
      `);

      if (productResult.recordset.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const title = productResult.recordset[0].title || '';

      const supplierRequest = pool.request();
      supplierRequest.input('ean', sql.NVarChar, payload.ean);
      const supplierResult = await supplierRequest.query(`
        SELECT csp.supplier_code, ISNULL(cs.display_name, csp.supplier_code) AS display_name,
               csp.stock_quantity, csp.price_eur
        FROM consolidated.supplier_product csp
        LEFT JOIN consolidated.supplier cs ON cs.supplier_code = csp.supplier_code
        WHERE csp.ean = @ean AND csp.stock_quantity > 0
        ORDER BY csp.price_eur ASC
      `);

      const supplierRows: InternalSupplierDetail[] = (supplierResult.recordset as SupplierRow[]).map((row) => ({
        supplier: row.display_name || row.supplier_code,
        stock: row.stock_quantity || 0,
        unitPrice: row.price_eur || 0,
      }));

      let requesterEmailSent = false;
      let internalEmailSent = false;

      if (RESEND_API_KEY) {
        const resend = new Resend(RESEND_API_KEY);

        const requesterSend = await resend.emails.send({
          from: REQUEST_FROM_EMAIL,
          to: [normalizedEmail],
          subject: `Supplier details for ${title || payload.ean}`,
          html: buildRequesterEmailHtml({ ean: payload.ean, title, supplierRows }),
        });
        requesterEmailSent = !requesterSend.error;

        if (REQUEST_INTERNAL_EMAIL) {
          const internalSend = await resend.emails.send({
            from: REQUEST_FROM_EMAIL,
            to: [REQUEST_INTERNAL_EMAIL],
            subject: `New supplier request: ${payload.ean}`,
            html: buildInternalEmailHtml({
              ean: payload.ean,
              email: normalizedEmail,
              sourcePage: payload.sourcePage || '',
              title,
              supplierRows,
            }),
          });
          internalEmailSent = !internalSend.error;
        }
      }

      console.log('Supplier price request logged:', {
        ean: payload.ean,
        email: normalizedEmail,
        sourcePage: payload.sourcePage || '',
        createdAt: new Date().toISOString(),
        requesterEmailSent,
        internalEmailSent,
      });

      res.status(202).json({
        accepted: true,
        requesterEmailSent,
        internalEmailSent,
      });
    } catch (err) {
      console.error('Error processing supplier price request', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/categories', async (_req, res) => {
    try {
      const pool = await getPool();
      const catRequest = pool.request();
      const catResult = await catRequest.query(`
        SELECT category, COUNT(*) AS product_count
        FROM enriched.product
        WHERE category IS NOT NULL AND category <> ''
        GROUP BY category
        ORDER BY product_count DESC
      `);

      const brandRequest = pool.request();
      const brandResult = await brandRequest.query(`
        SELECT DISTINCT category, brand
        FROM enriched.product
        WHERE category IS NOT NULL AND category <> ''
          AND brand IS NOT NULL AND brand <> ''
      `);

      const categories = (catResult.recordset as CategoryRow[]).map((row) => ({
        name: row.category,
        count: row.product_count,
      }));

      const brandsByCategory: Record<string, string[]> = {};
      for (const row of brandResult.recordset as BrandByCategoryRow[]) {
        if (!brandsByCategory[row.category]) {
          brandsByCategory[row.category] = [];
        }
        brandsByCategory[row.category].push(row.brand);
      }
      for (const key of Object.keys(brandsByCategory)) {
        brandsByCategory[key].sort((a, b) => a.localeCompare(b));
      }

      res.json({ categories, brandsByCategory });
    } catch (err) {
      console.error('Error fetching categories', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`WebVersion API listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error('Failed to bootstrap WebVersion API', error);
});
