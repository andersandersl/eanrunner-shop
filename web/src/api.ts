import type {
  CatalogStatsResponse,
  CategoriesResponse,
  ProductDetailResponse,
  ProductFullDetail,
  ProductListResponse,
  SignupInterestPayload,
} from './types';

const CLOUD_RUN_API_BASE = 'https://eanrunner-shop-api-jsqvfzhjra-ew.a.run.app';

// In production, force Cloud Run to avoid stale platform env values pointing to old backends.
const RAW_API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787')
  : CLOUD_RUN_API_BASE;
const API_BASE = /^https?:\/\//i.test(RAW_API_BASE) ? RAW_API_BASE : `https://${RAW_API_BASE}`;

function createHeaders(idToken?: string, allowedSuppliers?: string[], approvedEmail?: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  // Pass approved suppliers from Firestore client state so API can fall back
  // when backend Firestore lookup is unavailable.
  if (allowedSuppliers && allowedSuppliers.length > 0) {
    headers['x-approved-suppliers'] = allowedSuppliers.join(',');
    if (approvedEmail) headers['x-approved-email'] = approvedEmail;
  }
  return headers;
}

async function readJson<T>(path: string, idToken?: string, allowedSuppliers?: string[], approvedEmail?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: createHeaders(idToken, allowedSuppliers, approvedEmail),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getProducts(
  query: string,
  limit = 48,
  category?: string,
  brand?: string,
  market = 'dk',
  page = 1,
  grades?: Set<string>,
  idToken?: string,
  allowedSuppliers?: string[],
  approvedEmail?: string,
  inStock?: boolean,
  hasImage?: boolean,
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  params.set('market', market);
  if (grades && grades.size > 0) params.set('grades', [...grades].join(','));
  if (inStock) params.set('inStock', 'true');
  if (hasImage) params.set('hasImage', 'true');
  return readJson<ProductListResponse>(`/api/public/products?${params.toString()}`, idToken, allowedSuppliers, approvedEmail);
}

export function getCategories(idToken?: string): Promise<CategoriesResponse> {
  return readJson<CategoriesResponse>('/api/public/categories', idToken);
}

export function getCatalogStats(idToken?: string): Promise<CatalogStatsResponse> {
  return readJson<CatalogStatsResponse>('/api/public/stats', idToken);
}

export function getProductByEan(ean: string, idToken?: string): Promise<ProductDetailResponse> {
  return readJson<ProductDetailResponse>(`/api/public/products/${encodeURIComponent(ean)}`, idToken);
}

export function getProductDetail(
  ean: string,
  idToken?: string,
  allowedSuppliers?: string[],
  approvedEmail?: string,
): Promise<ProductFullDetail> {
  return readJson<ProductFullDetail>(`/api/public/products/${encodeURIComponent(ean)}/detail`, idToken, allowedSuppliers, approvedEmail);
}

export async function requestSupplierPrice(payload: { ean: string; email: string; sourcePage: string }): Promise<void> {
  const response = await fetch(`${API_BASE}/api/public/request-supplier-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
}

export async function submitSignupInterest(payload: SignupInterestPayload): Promise<void> {
  const response = await fetch(`${API_BASE}/api/public/signup-interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
}
