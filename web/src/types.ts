export type MarginGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'N/A';

export type PublicProduct = {
  ean: string;
  title: string;
  brand: string;
  category: string;
  image: string | null;
  stockStatus: 'in stock' | 'not in stock';
  marginGrade: MarginGrade;
  competitorCount: number;
  marketPrice: number | null;
  marketCurrency: string | null;
  cheapestMarketLink: string | null;
  actualMarginPercent: number | null;
  actualMarginAmount: number | null;
  updatedAt: string | null;
  supplierRows?: Array<{ supplier: string; stock: number; price: number; currency: string }>;
};

export type ProductListResponse = {
  products: PublicProduct[];
  count: number;
  total: number;
};

export type ProductDetailResponse = {
  product: PublicProduct;
};

export type CategoryEntry = {
  name: string;
  count: number;
};

export type CategoriesResponse = {
  categories: CategoryEntry[];
  brandsByCategory: Record<string, string[]>;
};

export type CatalogStatsResponse = {
  totalProducts: number;
  inStockProducts: number;
};

export type SignupInterestPayload = {
  name: string;
  email: string;
  companyVatNumber: string;
  marketingConsent: boolean;
};

export type ProductTranslation = {
  languageCode: string;
  title: string | null;
  description: string | null;
  status: string;
};

export type ProductDimensions = {
  weightG: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
};

export type ProductFullDetail = {
  ean: string;
  title: string;
  brand: string;
  description: string | null;
  category: string;
  images: string[];
  mpn: string | null;
  model: string | null;
  color: string | null;
  countryOfOrigin: string | null;
  dimensions: ProductDimensions;
  attributeGroups: Record<string, Record<string, string>>;
  translations: ProductTranslation[];
  supplierCount: number;
  totalStock: number;
  supplierRows: Array<{
    supplierCode: string;
    supplierName: string;
    stockQuantity: number;
    unitPriceEur: number;
  }>;
  marketSnapshot: {
    market: string;
    currency: string | null;
    cheapestPriceGross: number | null;
    cheapestPriceNet: number | null;
    cheapestSupplierPriceEur: number | null;
    marginAmount: number | null;
    marginPercent: number | null;
  } | null;
  enrichedAt: string | null;
};

export type ApprovedAccount = {
  email: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  allowedSuppliers?: string[];
};
