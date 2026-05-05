import type { CategoriesResponse, ProductDetailResponse, ProductFullDetail, ProductListResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
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
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  params.set('market', market);
  if (grades && grades.size > 0) params.set('grades', [...grades].join(','));
  return readJson<ProductListResponse>(`/api/public/products?${params.toString()}`);
}

export function getCategories(): Promise<CategoriesResponse> {
  return readJson<CategoriesResponse>('/api/public/categories');
}

export function getProductByEan(ean: string): Promise<ProductDetailResponse> {
  return readJson<ProductDetailResponse>(`/api/public/products/${encodeURIComponent(ean)}`);
}

export function getProductDetail(ean: string): Promise<ProductFullDetail> {
  return readJson<ProductFullDetail>(`/api/public/products/${encodeURIComponent(ean)}/detail`);
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
