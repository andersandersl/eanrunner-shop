import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Tag, Package, Layers } from 'lucide-react';
import { getProductDetail, requestSupplierPrice } from './api';
import type { ProductFullDetail } from './types';

const LANG_LABELS: Record<string, string> = {
  'en': 'English',
  'da-DK': 'Danish',
  'sv-SE': 'Swedish',
  'fi-FI': 'Finnish',
  'de': 'German',
  'fr': 'French',
  'nl': 'Dutch',
};

function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

export default function ProductDetailPage() {
  const { ean } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductFullDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [requestModal, setRequestModal] = useState(false);

  useEffect(() => {
    if (!ean) return;
    setLoading(true);
    setError('');
    getProductDetail(ean)
      .then((data) => { setProduct(data); setActiveImage(0); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load product'))
      .finally(() => setLoading(false));
  }, [ean]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(220_18%_97%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(221_92%_55%)]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[hsl(220_18%_97%)] gap-4">
        <p className="text-red-600">{error || 'Product not found'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[hsl(221_92%_55%)] hover:underline cursor-pointer">← Back</button>
      </div>
    );
  }

  const hasTranslations = product.translations.length > 0;
  const hasDimensions = Object.values(product.dimensions).some((v) => v != null);
  const hasAttributes = Object.keys(product.attributeGroups).length > 0;

  return (
    <div className="min-h-screen bg-[hsl(220_18%_97%)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 h-14 flex items-center gap-3 px-5 border-b border-[hsl(220_14%_89%)] bg-white/90 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[hsl(220_12%_40%)] hover:text-[hsl(222_47%_8%)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-[hsl(220_14%_83%)]">/</span>
        <span className="text-sm font-semibold text-[hsl(222_47%_8%)] truncate">{product.title}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[hsl(220_14%_89%)] aspect-square flex items-center justify-center overflow-hidden p-6">
            {product.images.length > 0 ? (
              <img
                src={product.images[activeImage]}
                alt={product.title}
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-20 bg-[hsl(220_14%_89%)] rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8 text-[hsl(220_12%_60%)]" />
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden bg-white flex items-center justify-center p-1 transition-colors cursor-pointer ${
                    i === activeImage ? 'border-[hsl(221_92%_55%)]' : 'border-[hsl(220_14%_89%)] hover:border-[hsl(221_92%_70%)]'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Core info */}
        <div className="space-y-5">
          <div>
            <p className="text-sm text-[hsl(220_12%_50%)] font-medium">{product.brand}</p>
            <h1 className="text-xl font-bold text-[hsl(222_47%_8%)] mt-1 leading-snug">{product.title}</h1>
            <p className="text-xs text-[hsl(220_12%_50%)] mt-1 font-mono">EAN: {product.ean}</p>
          </div>

          {/* Stock info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              product.supplierCount > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${product.supplierCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              {product.supplierCount > 0 ? 'In stock' : 'Out of stock'}
            </span>
            {product.supplierCount > 0 && (
              <span className="text-xs text-[hsl(220_12%_45%)]">
                <strong className="text-[hsl(222_47%_8%)]">{product.supplierCount}</strong> supplier{product.supplierCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {product.category && <Spec label="Category" value={product.category} />}
            {product.model && <Spec label="Model" value={product.model} />}
            {product.mpn && <Spec label="MPN" value={product.mpn} />}
            {product.color && <Spec label="Color" value={product.color} />}
            {product.countryOfOrigin && <Spec label="Origin" value={product.countryOfOrigin} />}
          </div>

          {/* Request supplier button */}
          <button
            onClick={() => setRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[hsl(221_92%_55%)] rounded-lg hover:bg-[hsl(221_92%_48%)] transition-colors cursor-pointer"
          >
            <Tag className="w-4 h-4" />
            Request supplier details
          </button>

          {/* English description */}
          {product.description && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] mb-1.5">Description (EN)</h2>
              <div
                className="text-sm text-[hsl(222_20%_20%)] leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Translations */}
      {hasTranslations && (
        <Section title="Translations" icon={<Layers className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {product.translations.map((t) => (
              <div key={t.languageCode} className="bg-white rounded-lg border border-[hsl(220_14%_89%)] p-4 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">{langLabel(t.languageCode)}</p>
                {t.title && <p className="text-sm font-semibold text-[hsl(222_47%_8%)]">{t.title}</p>}
                {t.description && (
                  <div
                    className="text-xs text-[hsl(222_20%_30%)] leading-relaxed line-clamp-6"
                    dangerouslySetInnerHTML={{ __html: t.description }}
                  />
                )}
                {!t.description && <p className="text-xs text-[hsl(220_12%_60%)] italic">Title only</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dimensions */}
      {hasDimensions && (
        <Section title="Dimensions & Weight">
          <div className="flex flex-wrap gap-4">
            {product.dimensions.widthMm != null && <Metric label="Width" value={`${product.dimensions.widthMm} mm`} />}
            {product.dimensions.heightMm != null && <Metric label="Height" value={`${product.dimensions.heightMm} mm`} />}
            {product.dimensions.depthMm != null && <Metric label="Depth" value={`${product.dimensions.depthMm} mm`} />}
            {product.dimensions.weightG != null && <Metric label="Weight" value={`${product.dimensions.weightG} g`} />}
          </div>
        </Section>
      )}

      {/* Attributes */}
      {hasAttributes && (
        <Section title="Specifications">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(product.attributeGroups).map(([group, attrs]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)] mb-2">{group}</p>
                <dl className="space-y-1">
                  {Object.entries(attrs).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <dt className="text-[hsl(220_12%_45%)] shrink-0 w-32 truncate">{k}</dt>
                      <dd className="text-[hsl(222_47%_8%)] font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="h-16" />

      {requestModal && (
        <RequestSupplierModal ean={product.ean} title={product.title} onClose={() => setRequestModal(false)} />
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-[hsl(220_14%_89%)] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">{label}</p>
      <p className="text-xs font-medium text-[hsl(222_47%_8%)] mt-0.5 truncate">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-[hsl(220_14%_89%)] px-4 py-3 text-center min-w-[90px]">
      <p className="text-[9px] uppercase tracking-wider text-[hsl(220_12%_55%)] font-semibold">{label}</p>
      <p className="text-sm font-bold text-[hsl(222_47%_8%)] mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 border-t border-[hsl(220_14%_89%)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(222_47%_8%)] mb-4">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function RequestSupplierModal({ ean, title, onClose }: { ean: string; title: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState('sending');
    try {
      await requestSupplierPrice({ ean, email, sourcePage: 'webversion-detail' });
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[hsl(220_14%_89%)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(220_14%_89%)]">
          <h2 className="text-base font-semibold text-[hsl(222_47%_8%)]">Request supplier details</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[hsl(220_14%_93%)] cursor-pointer">✕</button>
        </div>
        <div className="px-6 py-5">
          {state === 'done' ? (
            <div className="text-center py-4">
              <p className="font-semibold text-[hsl(222_47%_8%)]">Request sent!</p>
              <p className="text-sm text-[hsl(220_12%_40%)] mt-1">Supplier details will arrive in your inbox shortly.</p>
              <button onClick={onClose} className="mt-4 text-sm text-[hsl(221_92%_55%)] hover:underline cursor-pointer">Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-[hsl(220_12%_40%)]">
                Enter your email and we'll send supplier name, price, and stock details for <strong>{title}</strong>.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="w-full border border-[hsl(220_14%_89%)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
              />
              {state === 'error' && <p className="text-xs text-red-600">Could not submit request. Please try again.</p>}
              <button
                type="submit"
                disabled={state === 'sending'}
                className="w-full py-2.5 text-sm font-medium text-white bg-[hsl(221_92%_55%)] rounded-md hover:bg-[hsl(221_92%_48%)] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {state === 'sending' ? 'Sending...' : 'Send request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
