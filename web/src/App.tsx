import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Search, Tag, X } from 'lucide-react';
import { getCategories, getProducts } from './api';
import type { CategoryEntry, PublicProduct } from './types';
import logoIcon from './assets/logo-icon-transparent.svg';
import RequestSupplierModal from './components/RequestSupplierModal';
import LoginArea from './components/LoginArea';
import { useAuth } from './auth-context';

const PAGE_SIZE = 48;

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  B: { bg: 'bg-blue-100', text: 'text-blue-800' },
  C: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  D: { bg: 'bg-orange-100', text: 'text-orange-800' },
  E: { bg: 'bg-red-100', text: 'text-red-800' },
  F: { bg: 'bg-red-200', text: 'text-red-900' },
  'N/A': { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23F3F5F9'/%3E%3Ctext x='200' y='210' text-anchor='middle' font-family='Arial%2C sans-serif' font-size='18' fill='%239CA3AF'%3ENo Image%3C/text%3E%3C/svg%3E";

function competitionLevel(competitorCount: number | null | undefined): 0 | 1 | 2 | 3 {
  const count = Math.max(0, competitorCount ?? 0);
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const COMPETITION_LEVEL_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'No competition',
  1: 'Low competition',
  2: 'Medium competition',
  3: 'High competition',
};

function competitionBadge(level: 0 | 1 | 2 | 3): { label: string; chiliColor: string; chip: string } {
  switch (level) {
    case 0:
      return { label: 'No competition', chiliColor: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 1:
      return { label: 'Low competition', chiliColor: 'text-lime-600', chip: 'bg-lime-50 text-lime-700 border-lime-200' };
    case 2:
      return { label: 'Medium competition', chiliColor: 'text-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: 'High competition', chiliColor: 'text-red-600', chip: 'bg-red-50 text-red-700 border-red-200' };
  }
}

function applyClientFilters(
  items: PublicProduct[],
  keyword: string,
  selectedCompetitionLevels: Set<number>,
): PublicProduct[] {
  let filtered = items;
  if (selectedCompetitionLevels.size > 0) {
    filtered = filtered.filter((p) => selectedCompetitionLevels.has(competitionLevel(p.competitorCount)));
  }
  if (keyword) {
    filtered = filtered.filter((p) =>
      p.ean.toLowerCase().includes(keyword)
      || p.title.toLowerCase().includes(keyword)
      || p.brand.toLowerCase().includes(keyword),
    );
  }
  return filtered;
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function marginRangeLabel(grade: string, marketPrice: number | null, currency: string | null): string | null {
  if (!marketPrice || marketPrice <= 0 || grade === 'N/A') return null;
  const sym = currency === 'DKK' || currency === 'SEK' ? '' : '€';
  const suffix = currency === 'DKK' ? ' kr' : currency === 'SEK' ? ' kr' : '';
  const fmt = (v: number) => `${sym}${Math.round(Math.abs(v)).toLocaleString()}${suffix}`;
  switch (grade) {
    case 'A': return `More than +${fmt(marketPrice * 0.20)}`;
    case 'B': return `Between ${fmt(marketPrice * 0.10)} to ${fmt(marketPrice * 0.20)}`;
    case 'C': return `Between ${fmt(marketPrice * 0.05)} to ${fmt(marketPrice * 0.10)}`;
    case 'D': return `Between ${currency === 'DKK' || currency === 'SEK' ? '0 kr' : '\u20ac0'} to ${fmt(marketPrice * 0.05)}`;
    case 'E': return `Loss between 0 and -${fmt(marketPrice * 0.10)}`;
    case 'F': return `Less than -${fmt(marketPrice * 0.10)}`;
    default: return null;
  }
}

function ProductCard({
  product,
  onRequestPrice,
  hasSupplierAccess,
}: {
  product: PublicProduct;
  onRequestPrice: (ean: string) => void;
  hasSupplierAccess?: boolean;
}) {
  const grade = GRADE_STYLES[product.marginGrade] ?? GRADE_STYLES['N/A'];
  const rangeLabel = marginRangeLabel(product.marginGrade, product.marketPrice, product.marketCurrency);
  const level = competitionLevel(product.competitorCount);
  const hot = competitionBadge(level);
  const hasActualMargin = product.actualMarginPercent != null;
  const bestSupplier = product.supplierRows?.[0];

  return (
    <div className="bg-white rounded-xl border border-[hsl(220_14%_89%)] shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <Link to={`/product/${encodeURIComponent(product.ean)}`} className="block">
        <div className="aspect-square bg-[hsl(220_18%_97%)] overflow-hidden relative">
          <img
            src={product.image || PLACEHOLDER_IMAGE}
            alt={product.title}
            className="w-full h-full object-contain p-3"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
          />
          <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${grade.bg} ${grade.text}`}>
            {product.marginGrade}
          </span>
        </div>
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <Link to={`/product/${encodeURIComponent(product.ean)}`} className="block min-w-0 hover:underline decoration-[hsl(221_92%_55%)] underline-offset-2">
          <p className="text-[10px] text-[hsl(220_12%_50%)] font-medium truncate">{product.brand || '—'}</p>
          <h3 className="text-xs font-semibold text-[hsl(222_47%_8%)] line-clamp-2 leading-snug mt-0.5">{product.title}</h3>
          <p className="text-[9px] text-[hsl(220_12%_60%)] mt-0.5 font-mono tracking-tight">EAN: {product.ean}</p>
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full font-medium ${
            product.stockStatus === 'in stock'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${product.stockStatus === 'in stock' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {product.stockStatus === 'in stock' ? 'In stock' : 'Out of stock'}
          </span>
          <span className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full border font-medium ${hot.chip}`}>
            <span className={`leading-none ${hot.chiliColor}`}>🌶</span>
            <span className="truncate">{hot.label}</span>
          </span>
        </div>
        {hasSupplierAccess ? (
          <>
            <p className="text-[9px] text-[hsl(220_12%_45%)] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Possible margin:{' '}
              <span className="text-[hsl(222_47%_20%)] font-semibold">
                {hasActualMargin
                  ? `${product.actualMarginPercent?.toFixed(1)}%`
                  : 'Not available for your approved suppliers'}
              </span>
            </p>
            <p className="text-[9px] text-[hsl(220_12%_45%)] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Supplier:{' '}
              <span className="text-[hsl(222_47%_20%)] font-semibold">
                {bestSupplier ? bestSupplier.supplier : 'Not available for your approved suppliers'}
              </span>
              {bestSupplier ? ' · ' : ''}
              {bestSupplier ? (
                <span className="text-[hsl(222_47%_20%)] font-semibold">€{bestSupplier.price.toFixed(2)}</span>
              ) : null}
            </p>
          </>
        ) : hasActualMargin ? (
          <p className="text-[9px] text-[hsl(220_12%_45%)] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            Actual margin: <span className="text-[hsl(222_47%_20%)] font-semibold">{product.actualMarginPercent?.toFixed(1)}%</span>
          </p>
        ) : rangeLabel && (
          <p className="text-[9px] text-[hsl(220_12%_45%)] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            Est. margin: <span className="text-[hsl(222_47%_20%)] font-semibold">{rangeLabel}</span>
          </p>
        )}
        <div className="flex gap-1.5 mt-auto">
          {product.cheapestMarketLink ? (
            <a
              href={product.cheapestMarketLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-[hsl(221_92%_55%)] border border-[hsl(221_92%_55%)] rounded-md px-2 py-1.5 hover:bg-[hsl(221_80%_95%)] transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              {product.marketPrice != null
                ? (product.marketCurrency === 'DKK' || product.marketCurrency === 'SEK'
                    ? `${Math.round(product.marketPrice)} ${product.marketCurrency === 'DKK' ? 'kr' : 'kr'}`
                    : `€${product.marketPrice.toFixed(0)}`)
                : 'Market'}
            </a>
          ) : (
            <span className="flex-1" />
          )}
          {!hasSupplierAccess && (
            <button
              type="button"
              onClick={() => onRequestPrice(product.ean)}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-white bg-[hsl(221_92%_55%)] rounded-md px-2 py-1.5 hover:bg-[hsl(221_92%_48%)] transition-colors cursor-pointer"
            >
              <Tag className="w-2.5 h-2.5 shrink-0" />
              Supplier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

function FilterSidebar({
  categories,
  brandsByCategory,
  selectedCategory,
  selectedBrand,
  keyword,
  inStockOnly,
  hasPictureOnly,
  selectedCompetitionLevels,
  selectedGrades,
  market,
  onSelectCategory,
  onSelectBrand,
  onKeywordChange,
  onInStockOnlyChange,
  onHasPictureOnlyChange,
  onSelectedCompetitionLevelsChange,
  onSelectedGradesChange,
  onMarketChange,
  productCount,
  loading,
}: {
  categories: CategoryEntry[];
  brandsByCategory: Record<string, string[]>;
  selectedCategory: string;
  selectedBrand: string;
  keyword: string;
  inStockOnly: boolean;
  hasPictureOnly: boolean;
  selectedCompetitionLevels: Set<number>;
  selectedGrades: Set<string>;
  market: string;
  onSelectCategory: (c: string) => void;
  onSelectBrand: (b: string) => void;
  onKeywordChange: (k: string) => void;
  onInStockOnlyChange: (v: boolean) => void;
  onHasPictureOnlyChange: (v: boolean) => void;
  onSelectedCompetitionLevelsChange: (v: Set<number>) => void;
  onSelectedGradesChange: (g: Set<string>) => void;
  onMarketChange: (m: string) => void;
  productCount: number;
  loading: boolean;
}) {
  const [categorySearch, setCategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [catOpen, setCatOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);

  const allBrands = useMemo(() => {
    const s = new Set<string>();
    Object.values(brandsByCategory).forEach((arr) => arr.forEach((b) => s.add(b)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [brandsByCategory]);

  const brands = selectedCategory ? (brandsByCategory[selectedCategory] ?? []) : allBrands;

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.trim().toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const q = brandSearch.trim().toLowerCase();
    return brands.filter((b) => b.toLowerCase().includes(q));
  }, [brands, brandSearch]);

  return (
    <aside className="w-[260px] shrink-0 border-r border-[hsl(220_14%_89%)] bg-white flex flex-col sticky top-0 h-screen overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[hsl(220_14%_89%)] shrink-0">
        <Search className="w-4 h-4 text-[hsl(220_12%_50%)]" />
        <span className="text-sm font-semibold text-[hsl(222_47%_8%)]">Browse catalog</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Keyword search */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Search</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(220_12%_50%)]" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="EAN, title, brand…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[hsl(220_14%_89%)] rounded-md bg-[hsl(220_18%_97%)] text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
            />
          </div>
        </div>

        {/* Market selector */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Market</p>
          <div className="flex rounded-md border border-[hsl(220_14%_89%)] overflow-hidden text-[10px] font-semibold">
            {(['dk', 'se', 'fi'] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => onMarketChange(m)}
                className={`flex-1 py-1.5 transition-colors ${
                  market === m
                    ? 'bg-[hsl(221_92%_55%)] text-white'
                    : 'bg-white text-[hsl(220_12%_40%)] hover:bg-[hsl(220_18%_95%)]'
                } ${i > 0 ? 'border-l border-[hsl(220_14%_89%)]' : ''}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* In-stock toggle */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Stock</p>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={inStockOnly}
              onClick={() => onInStockOnlyChange(!inStockOnly)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                inStockOnly ? 'bg-[hsl(221_92%_55%)]' : 'bg-[hsl(220_14%_83%)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  inStockOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs text-[hsl(222_47%_8%)] whitespace-nowrap">In stock only</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={hasPictureOnly}
              onClick={() => onHasPictureOnlyChange(!hasPictureOnly)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                hasPictureOnly ? 'bg-[hsl(221_92%_55%)]' : 'bg-[hsl(220_14%_83%)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  hasPictureOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs text-[hsl(222_47%_8%)] whitespace-nowrap">Has picture only</span>
          </label>
        </div>

        {/* Margin grade filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Margin grade</p>
            {selectedGrades.size > 0 && (
              <button
                type="button"
                onClick={() => onSelectedGradesChange(new Set())}
                className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['A', 'B', 'C', 'D', 'E', 'F', 'N/A'] as const).map((g) => {
              const styles = GRADE_STYLES[g];
              const active = selectedGrades.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedGrades);
                    if (active) next.delete(g); else next.add(g);
                    onSelectedGradesChange(next);
                  }}
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                    active
                      ? `${styles.bg} ${styles.text} border-transparent ring-2 ring-offset-1 ring-current`
                      : 'bg-white text-[hsl(220_12%_50%)] border-[hsl(220_14%_85%)] hover:border-[hsl(220_14%_65%)]'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Competition filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Competition</p>
            {selectedCompetitionLevels.size > 0 && (
              <button
                type="button"
                onClick={() => onSelectedCompetitionLevelsChange(new Set())}
                className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([0, 1, 2, 3] as const).map((level) => {
              const active = selectedCompetitionLevels.has(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedCompetitionLevels);
                    if (active) next.delete(level); else next.add(level);
                    onSelectedCompetitionLevelsChange(next);
                  }}
                  className={`inline-flex items-center justify-center whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                    active
                      ? 'bg-[hsl(221_80%_95%)] text-[hsl(221_92%_40%)] border-transparent ring-2 ring-offset-1 ring-[hsl(221_92%_55%)]'
                      : 'bg-white text-[hsl(220_12%_50%)] border-[hsl(220_14%_85%)] hover:border-[hsl(220_14%_65%)]'
                  }`}
                >
                  {COMPETITION_LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category section */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setCatOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] hover:text-[hsl(222_47%_8%)] transition-colors"
          >
            <span>Category</span>
            <div className="flex items-center gap-1.5">
              {selectedCategory && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectCategory(''); setBrandSearch(''); }}
                  className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline normal-case tracking-normal"
                >
                  Clear
                </button>
              )}
              {catOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>
          </button>

          {catOpen && (
            <>
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Filter categories…"
                className="w-full px-2.5 py-1.5 text-xs border border-[hsl(220_14%_89%)] rounded-md bg-[hsl(220_18%_97%)] text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
              />
              <div className="max-h-60 overflow-y-auto -mx-1">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => { onSelectCategory(selectedCategory === cat.name ? '' : cat.name); setBrandSearch(''); onSelectBrand(''); }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
                      selectedCategory === cat.name
                        ? 'bg-[hsl(221_80%_95%)] font-semibold text-[hsl(221_92%_40%)]'
                        : 'text-[hsl(222_47%_8%)] hover:bg-[hsl(220_18%_95%)]'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-[hsl(220_12%_50%)]">{cat.count.toLocaleString()}</span>
                  </button>
                ))}
                {filteredCategories.length === 0 && (
                  <p className="px-2 py-2 text-xs text-[hsl(220_12%_50%)]">No categories match.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Brand section */}
        {brands.length > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setBrandOpen((v) => !v)}
              className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] hover:text-[hsl(222_47%_8%)] transition-colors"
            >
              <span>Brand</span>
              <div className="flex items-center gap-1.5">
                {selectedBrand && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelectBrand(''); }}
                    className="text-[9px] font-medium text-[hsl(221_92%_55%)] hover:underline normal-case tracking-normal"
                  >
                    Clear
                  </button>
                )}
                {brandOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </div>
            </button>

            {brandOpen && (
              <>
                {!selectedCategory && (
                  <p className="text-[10px] text-[hsl(220_12%_50%)]">Showing all brands</p>
                )}
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Filter brands…"
                  className="w-full px-2.5 py-1.5 text-xs border border-[hsl(220_14%_89%)] rounded-md bg-[hsl(220_18%_97%)] text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
                />
                <div className="max-h-60 overflow-y-auto -mx-1">
                  {filteredBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => onSelectBrand(selectedBrand === brand ? '' : brand)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
                        selectedBrand === brand
                          ? 'bg-[hsl(221_80%_95%)] font-semibold text-[hsl(221_92%_40%)]'
                          : 'text-[hsl(222_47%_8%)] hover:bg-[hsl(220_18%_95%)]'
                      }`}
                    >
                      <span className="truncate">{brand}</span>
                    </button>
                  ))}
                  {filteredBrands.length === 0 && (
                    <p className="px-2 py-2 text-xs text-[hsl(220_12%_50%)]">No brands match.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer: count */}
      <div className="px-4 py-3 border-t border-[hsl(220_14%_89%)] shrink-0">
        <p className="text-[10px] text-[hsl(220_12%_50%)]">
          {loading ? (
            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
          ) : (
            <>{productCount.toLocaleString()} products</>
          )}
        </p>
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const { user, idToken, approvedAccount, loading: authLoading } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [hasPictureOnly, setHasPictureOnly] = useState(false);
  const [selectedCompetitionLevels, setSelectedCompetitionLevels] = useState<Set<number>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [market, setMarket] = useState('dk');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalEan, setModalEan] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [brandsByCategory, setBrandsByCategory] = useState<Record<string, string[]>>({});

  const hasSupplierAccess = (approvedAccount?.allowedSuppliers?.length || 0) > 0 || approvedAccount?.isSuperAdmin === true;

  // Debounce keyword
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Load categories on mount
  useEffect(() => {
    getCategories(idToken)
      .then((data) => {
        setCategories(data.categories);
        setBrandsByCategory(data.brandsByCategory);
      })
      .catch((err) => console.error('Failed to load categories', err));
  }, [idToken]);

  // Load products whenever filters change
  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) {
        return;
      }
      if (user && hasSupplierAccess && !idToken) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        const normalizedKeyword = debouncedKeyword.trim();
        const effectiveLimit = PAGE_SIZE;
        const effectivePage = normalizedKeyword ? 1 : page;
        const data = await getProducts(
          normalizedKeyword,
          effectiveLimit,
          selectedCategory || undefined,
          selectedBrand || undefined,
          market,
          effectivePage,
          selectedGrades.size > 0 ? selectedGrades : undefined,
          idToken,
          approvedAccount?.allowedSuppliers,
          approvedAccount?.email,
          inStockOnly || undefined,
          hasPictureOnly || undefined,
        );
        const backendTotal = data.total ?? data.count;

        if (!active) return;
        setProducts(data.products);
        setTotalProducts(backendTotal);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load products');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [
    authLoading,
    user,
    debouncedKeyword,
    selectedCategory,
    selectedBrand,
    market,
    page,
    selectedGrades,
    inStockOnly,
    hasPictureOnly,
    selectedCompetitionLevels,
    idToken,
    approvedAccount?.allowedSuppliers,
    approvedAccount?.email,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    debouncedKeyword,
    selectedCategory,
    selectedBrand,
    market,
    selectedGrades,
    inStockOnly,
    hasPictureOnly,
    selectedCompetitionLevels,
  ]);

  const visibleProducts = useMemo(() => {
    const keyword = debouncedKeyword.trim().toLowerCase();
    const filtered = applyClientFilters(
      products,
      keyword,
      selectedCompetitionLevels,
    );

    return [...filtered]
      .sort((a, b) => {
      const aNa = a.marginGrade === 'N/A' ? 1 : 0;
      const bNa = b.marginGrade === 'N/A' ? 1 : 0;
      return aNa - bNa;
      })
      .slice(0, PAGE_SIZE);
  }, [products, selectedCompetitionLevels, debouncedKeyword]);

  const modalProduct = useMemo(
    () => (modalEan ? products.find((p) => p.ean === modalEan) || null : null),
    [products, modalEan],
  );

  return (
    <>
      {/* Icon nav sidebar — fixed far left */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[3.75rem] flex-col border-r border-[hsl(220_14%_90%)] bg-white shadow-sm md:flex">
        <div className="flex h-14 items-center justify-center border-b border-[hsl(220_14%_90%)]">
          <img src={logoIcon} alt="EANrunner" className="h-6 w-6 invert" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 py-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-[hsl(221_80%_95%)] text-[hsl(221_92%_55%)]"
            title="Catalog"
          >
            <Search className="w-4 h-4" />
          </div>
        </div>
      </aside>

      {/* Content layout — offset by icon sidebar (padding-left: 3.75rem set in index.css) */}
      <div className="flex min-h-screen">
        {/* Filter sidebar */}
        <FilterSidebar
          categories={categories}
          brandsByCategory={brandsByCategory}
          selectedCategory={selectedCategory}
          selectedBrand={selectedBrand}
          keyword={keyword}
          inStockOnly={inStockOnly}
          hasPictureOnly={hasPictureOnly}
          selectedCompetitionLevels={selectedCompetitionLevels}
          selectedGrades={selectedGrades}
          market={market}
          onSelectCategory={(c) => { setSelectedCategory(c); if (!c) setSelectedBrand(''); }}
          onSelectBrand={setSelectedBrand}
          onKeywordChange={setKeyword}
          onInStockOnlyChange={setInStockOnly}
          onHasPictureOnlyChange={setHasPictureOnly}
          onSelectedCompetitionLevelsChange={setSelectedCompetitionLevels}
          onSelectedGradesChange={setSelectedGrades}
          onMarketChange={setMarket}
          productCount={totalProducts}
          loading={loading}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <div className="sticky top-0 z-40 h-14 flex items-center gap-3 px-5 border-b border-[hsl(220_14%_89%)] bg-white/90 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(222_47%_8%)]">
              EANrunner
              <span className="text-[hsl(220_12%_70%)] font-normal">/</span>
              <span>Product catalog</span>
            </div>

            {/* Active filter breadcrumbs */}
            {(selectedCategory || selectedBrand) && (
              <div className="flex items-center gap-1.5">
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 text-xs bg-[hsl(221_80%_95%)] text-[hsl(221_92%_40%)] font-medium px-2 py-0.5 rounded-full">
                    {selectedCategory}
                    <button type="button" onClick={() => { setSelectedCategory(''); setSelectedBrand(''); }} className="cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedBrand && (
                  <span className="inline-flex items-center gap-1 text-xs bg-[hsl(221_80%_95%)] text-[hsl(221_92%_40%)] font-medium px-2 py-0.5 rounded-full">
                    {selectedBrand}
                    <button type="button" onClick={() => setSelectedBrand('')} className="cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            <div className="ml-auto text-xs text-[hsl(220_12%_50%)]">
              {loading ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
              ) : (
                `${totalProducts.toLocaleString()} products`
              )}
            </div>

            <Link
              to="/signup"
              className="inline-flex items-center rounded-md bg-[hsl(221_92%_55%)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
            >
              Register for free
            </Link>

            <LoginArea />
          </div>

          {/* Product grid */}
          <div className="flex-1 p-5">
            {/* Info banner */}
            <div className="mb-5 rounded-lg border border-[hsl(221_60%_88%)] bg-[hsl(221_80%_97%)] px-4 py-3 text-xs text-[hsl(221_40%_35%)] space-y-1">
              <p className="font-semibold text-[hsl(221_60%_30%)] text-[11px] uppercase tracking-wide">About this catalog</p>
              <p>
                {hasSupplierAccess
                  ? 'You are signed in with supplier access. Prices, stock and margins use your approved suppliers only.'
                  : 'Supplier names and exact prices are not shown. Each product displays a margin grade based on supplier cost vs. the cheapest public market price.'}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                {[
                  { grade: 'A', label: 'Above 20%', bg: 'bg-emerald-100', text: 'text-emerald-800' },
                  { grade: 'B', label: '10–20%', bg: 'bg-blue-100', text: 'text-blue-800' },
                  { grade: 'C', label: '5–10%', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                  { grade: 'D', label: '0–5%', bg: 'bg-orange-100', text: 'text-orange-800' },
                  { grade: 'E', label: 'Loss 0–10%', bg: 'bg-red-100', text: 'text-red-800' },
                  { grade: 'F', label: 'Loss >10%', bg: 'bg-red-200', text: 'text-red-900' },
                ].map(({ grade, label, bg, text }) => (
                  <span key={grade} className="inline-flex items-center gap-1">
                    <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${bg} ${text}`}>{grade}</span>
                    <span className="text-[hsl(220_12%_40%)]">{label}</span>
                  </span>
                ))}
              </div>
              {!user && (
                <div className="pt-1">
                  <p className="text-xs text-[hsl(221_40%_35%)]">Sign in via the <span className="font-semibold">Login</span> button to unlock supplier prices, stock and exact margins.</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {!loading && visibleProducts.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Search className="w-10 h-10 text-[hsl(220_12%_70%)] mb-3" />
                <p className="text-sm font-medium text-[hsl(222_47%_8%)]">No products found</p>
                <p className="text-xs text-[hsl(220_12%_40%)] mt-1">
                  {selectedCategory || keyword ? 'Try adjusting your filters' : 'Select a category or search by keyword'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.ean}
                  product={product}
                  onRequestPrice={setModalEan}
                  hasSupplierAccess={hasSupplierAccess}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalProducts > PAGE_SIZE && !loading && (
              <div className="flex items-center justify-center gap-3 mt-8 pb-2">
                <button
                  type="button"
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-xs text-[hsl(220_12%_45%)]">
                  Page {page} of {Math.ceil(totalProducts / PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page >= Math.ceil(totalProducts / PAGE_SIZE)}
                  className="px-4 py-1.5 text-xs font-medium rounded-md border border-[hsl(220_12%_80%)] bg-white text-[hsl(222_47%_12%)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(221_60%_97%)] transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {modalProduct && (
        <RequestSupplierModal
          ean={modalProduct.ean}
          title={modalProduct.title}
          sourcePage="webversion-catalog"
          onClose={() => setModalEan(null)}
        />
      )}
    </>
  );
}

export default App;

