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
  updatedAt: string | null;
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
  enrichedAt: string | null;
};
