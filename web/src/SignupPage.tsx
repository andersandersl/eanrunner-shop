import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { getCatalogStats, submitSignupInterest } from './api';

function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyVatNumber, setCompanyVatNumber] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [inStockProducts, setInStockProducts] = useState<number | null>(null);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getCatalogStats()
      .then((stats) => {
        setInStockProducts(stats.inStockProducts);
        setTotalProducts(stats.totalProducts);
      })
      .catch(() => {
        setInStockProducts(null);
        setTotalProducts(null);
      })
      .finally(() => setLoadingStats(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!marketingConsent) {
      setError('Please provide marketing consent to continue.');
      return;
    }
    try {
      setSubmitting(true);
      await submitSignupInterest({
        name: name.trim(),
        email: email.trim(),
        companyVatNumber: companyVatNumber.trim(),
        marketingConsent,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the form');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(220_22%_96%)] text-[hsl(222_47%_12%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(221_92%_45%)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to catalog
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-[hsl(220_14%_88%)] bg-white p-6 md:p-8 shadow-sm">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-[hsl(220_12%_45%)]">EANrunner for retailers</p>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold leading-tight text-[hsl(222_47%_10%)]">
              Register for free and unlock direct supplier access
            </h1>
            <p className="mt-3 text-sm text-[hsl(220_12%_36%)] leading-relaxed">
              EANrunner helps retailers source smarter: see where products are available, compare purchasing opportunities,
              and identify margin potential before you buy.
            </p>

            <div className="mt-6 rounded-xl border border-[hsl(145_55%_84%)] bg-[hsl(145_65%_96%)] px-4 py-3 text-sm text-[hsl(145_45%_24%)]">
              {loadingStats ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading live catalog stats…</span>
              ) : (
                <span>
                  You get instant access to <strong>{(inStockProducts ?? 0).toLocaleString()}</strong> in-stock products
                  {typeof totalProducts === 'number' ? (
                    <> out of <strong>{totalProducts.toLocaleString()}</strong> total products in the catalog.</>
                  ) : (
                    <>.</>
                  )}
                </span>
              )}
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[hsl(220_12%_45%)]">What you get</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-[hsl(220_14%_28%)]">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />A clear overview of product availability</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />Buy closer to source and reduce middleman costs</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />Easy visibility into purchasing prices</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />Fast overview of margin opportunities</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />Integrations for Shopify, Magento, and WooCommerce</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(221_92%_55%)]" />Access to PricePilot for real-time price automation</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-[hsl(220_14%_88%)] bg-white p-6 md:p-8 shadow-sm">
            {submitted ? (
              <div className="rounded-xl border border-[hsl(145_55%_84%)] bg-[hsl(145_65%_96%)] px-4 py-4 text-sm text-[hsl(145_45%_24%)]">
                <p className="font-semibold">Thank you, your registration was received.</p>
                <p className="mt-1">We will contact you shortly with next steps and supplier access details.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <h2 className="text-lg font-semibold text-[hsl(222_47%_10%)]">Create your free account</h2>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_45%)]">Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-[hsl(220_14%_85%)] bg-[hsl(220_18%_98%)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)]"
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_45%)]">Work email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-[hsl(220_14%_85%)] bg-[hsl(220_18%_98%)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)]"
                    placeholder="name@company.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_45%)]">Company EU VAT number</label>
                  <input
                    required
                    value={companyVatNumber}
                    onChange={(e) => setCompanyVatNumber(e.target.value)}
                    className="w-full rounded-md border border-[hsl(220_14%_85%)] bg-[hsl(220_18%_98%)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)]"
                    placeholder="SE123456789001"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-[hsl(220_12%_35%)] leading-relaxed">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[hsl(220_14%_75%)]"
                  />
                  <span>
                    I agree that EANrunner may contact me by email about onboarding, product updates, and relevant B2B offers.
                    I understand I can withdraw consent at any time by using unsubscribe links or contacting EANrunner.
                  </span>
                </label>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-[hsl(221_92%_55%)] text-white py-2.5 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Register for free'}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
