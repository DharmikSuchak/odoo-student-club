import { AlertCircle, CheckCircle, Edit2, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import type { ApiError, MerchandiseProduct, MerchandiseVariant } from '../../lib/api-client';
import { apiCreateProduct, apiListProducts, apiUpdateProduct } from '../../lib/api-client';

import './store.css';

interface VariantDraft {
  size: string;
  stockQuantity: string; // string for input control; parsed on submit
}

interface FormErrors {
  name?: string;
  priceCents?: string;
  currency?: string;
  variants?: string;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function makeEmptyVariant(): VariantDraft {
  return { size: '', stockQuantity: '0' };
}

function ProductForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: MerchandiseProduct | null;
  onSaved: (product: MerchandiseProduct) => void;
  onCancel: () => void;
}) {
  const isEditing = initial !== null;

  const [name, setName] = useState(initial?.name ?? '');
  const [priceCents, setPriceCents] = useState(
    initial !== undefined && initial !== null ? String(initial.priceCents / 100) : '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial?.variants.map((v) => ({ size: v.size, stockQuantity: String(v.stockQuantity) })) ?? [
      makeEmptyVariant(),
    ],
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  function addVariant() {
    setVariants((prev) => [...prev, makeEmptyVariant()]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariantSize(index: number, value: string) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, size: value } : v)));
  }

  function updateVariantStock(index: number, value: string) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, stockQuantity: value } : v)));
  }

  function validate(): MerchandiseVariant[] | null {
    const nextErrors: FormErrors = {};
    if (name.trim().length === 0) nextErrors.name = 'Product name is required.';
    const priceNum = parseFloat(priceCents);
    if (isNaN(priceNum) || priceNum <= 0) nextErrors.priceCents = 'Enter a positive price.';
    if (!/^[A-Za-z]{3}$/.test(currency.trim()))
      nextErrors.currency = 'Use a 3-letter currency code (e.g. INR, USD).';

    const parsed: MerchandiseVariant[] = [];
    const seenSizes = new Set<string>();
    for (const v of variants) {
      const size = v.size.trim().toUpperCase();
      if (size.length === 0) {
        nextErrors.variants = 'Each size label must not be empty.';
        break;
      }
      if (seenSizes.has(size)) {
        nextErrors.variants = `Duplicate size "${size}". Each size must be unique.`;
        break;
      }
      seenSizes.add(size);
      const stock = parseInt(v.stockQuantity, 10);
      if (isNaN(stock) || stock < 0) {
        nextErrors.variants = 'Stock quantities must be non-negative integers.';
        break;
      }
      parsed.push({ size, stockQuantity: stock });
    }
    if (parsed.length === 0 && nextErrors.variants === undefined) {
      nextErrors.variants = 'Add at least one size variant.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    return parsed;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavedOk(false);
    setServerError(null);

    const parsedVariants = validate();
    if (parsedVariants === null) return;

    const payload = {
      name: name.trim(),
      priceCents: Math.round(parseFloat(priceCents) * 100),
      currency: currency.trim().toUpperCase(),
      variants: parsedVariants,
    };

    setIsSaving(true);
    try {
      let result: MerchandiseProduct;
      if (isEditing && initial !== null) {
        const res = await apiUpdateProduct(initial._id, payload);
        result = res.product;
      } else {
        const res = await apiCreateProduct(payload);
        result = res.product;
      }
      setSavedOk(true);
      onSaved(result);
      if (!isEditing) {
        setName('');
        setPriceCents('');
        setCurrency('INR');
        setVariants([makeEmptyVariant()]);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setServerError(apiErr.message ?? 'Failed to save product.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="store-form-card" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className="store-form-title">{isEditing ? 'Edit product' : 'New product'}</h2>

      {savedOk && (
        <div className="store-notice store-notice--success" role="status">
          <CheckCircle size={18} aria-hidden="true" />
          <span>{isEditing ? 'Product updated.' : 'Product created successfully.'}</span>
        </div>
      )}

      {serverError !== null && (
        <div className="store-notice store-notice--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="store-field">
        <label className="store-label" htmlFor="product-name">
          Product name
        </label>
        <input
          id="product-name"
          type="text"
          className={`store-input${errors.name !== undefined ? ' store-input--error' : ''}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="e.g. Club Hoodie"
          required
        />
        {errors.name !== undefined && (
          <p className="store-field-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px' }}>
        <div className="store-field">
          <label className="store-label" htmlFor="product-price">
            Price (in whole units)
          </label>
          <input
            id="product-price"
            type="number"
            className={`store-input${errors.priceCents !== undefined ? ' store-input--error' : ''}`}
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="25.00"
            required
          />
          {errors.priceCents !== undefined && (
            <p className="store-field-error" role="alert">
              {errors.priceCents}
            </p>
          )}
        </div>

        <div className="store-field">
          <label className="store-label" htmlFor="product-currency">
            Currency
          </label>
          <input
            id="product-currency"
            type="text"
            className={`store-input${errors.currency !== undefined ? ' store-input--error' : ''}`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="INR"
            required
          />
          {errors.currency !== undefined && (
            <p className="store-field-error" role="alert">
              {errors.currency}
            </p>
          )}
        </div>
      </div>

      <div className="store-field">
        <p className="store-label" id="variants-label">
          Size variants &amp; stock
        </p>
        {errors.variants !== undefined && (
          <p className="store-field-error" role="alert">
            {errors.variants}
          </p>
        )}
        <div role="group" aria-labelledby="variants-label">
          {variants.map((variant, index) => (
            <div key={index} className="store-variant-row">
              <input
                type="text"
                className="store-input"
                aria-label={`Size label for variant ${String(index + 1)}`}
                value={variant.size}
                onChange={(e) => updateVariantSize(index, e.target.value)}
                placeholder="e.g. M, L, XL"
                maxLength={20}
              />
              <input
                type="number"
                className="store-input"
                aria-label={`Stock quantity for variant ${String(index + 1)}`}
                value={variant.stockQuantity}
                onChange={(e) => updateVariantStock(index, e.target.value)}
                min="0"
                step="1"
                placeholder="0"
              />
              <button
                type="button"
                className="store-variant-remove"
                aria-label={`Remove variant ${variant.size || String(index + 1)}`}
                onClick={() => removeVariant(index)}
                disabled={variants.length === 1}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="store-add-variant-btn"
          onClick={addVariant}
          disabled={variants.length >= 30}
        >
          <Plus size={14} />
          Add size
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          id={isEditing ? 'store-update-product-btn' : 'store-create-product-btn'}
          type="submit"
          className="store-btn-primary"
          disabled={isSaving}
          aria-busy={isSaving}
          style={{ flex: 1 }}
        >
          {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Create product'}
        </button>
        {isEditing && (
          <button type="button" className="store-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function StoreManagePage() {
  const [products, setProducts] = useState<MerchandiseProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<MerchandiseProduct | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function load() {
      try {
        const res = await apiListProducts();
        if (!cancelled) setProducts(res.products);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setLoadError(apiErr.message ?? 'Failed to load products.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleSaved(saved: MerchandiseProduct) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p._id === saved._id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    setEditingProduct(null);
  }

  return (
    <div className="store-page">
      <Link to="/merchandise" className="store-back-link">
        Back to store
      </Link>

      <div className="store-heading-row">
        <div>
          <h1 className="store-title">Product Manager</h1>
          <p className="store-subtitle">
            Create and edit products. Role checked by the server on every request.
          </p>
        </div>
        {editingProduct !== null && (
          <button type="button" className="store-btn-ghost" onClick={() => setEditingProduct(null)}>
            + New product
          </button>
        )}
      </div>

      <div className="store-manager-grid">
        <ProductForm
          key={editingProduct?._id ?? 'new'}
          initial={editingProduct}
          onSaved={handleSaved}
          onCancel={() => setEditingProduct(null)}
        />

        <div className="store-product-list-card">
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'var(--slate-800)',
              marginBottom: '16px',
            }}
          >
            Existing products
          </h2>

          {isLoading && (
            <div role="status" aria-label="Loading products">
              {[1, 2, 3].map((key) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <div className="store-skeleton-line store-skeleton-line--medium" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && loadError !== null && (
            <div className="store-notice store-notice--danger" role="alert">
              <AlertCircle size={16} />
              <span>{loadError}</span>
            </div>
          )}

          {!isLoading && loadError === null && products.length === 0 && (
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              No products yet. Create one using the form.
            </p>
          )}

          {!isLoading &&
            loadError === null &&
            products.map((product) => (
              <div key={product._id} className="store-product-list-item">
                <div className="store-product-list-info">
                  <p className="store-product-list-name">{product.name}</p>
                  <p className="store-product-list-meta">
                    {formatMoney(product.priceCents, product.currency)} · {product.variants.length}{' '}
                    size
                    {product.variants.length !== 1 ? 's' : ''} ·{' '}
                    {product.variants.reduce((s, v) => s + v.stockQuantity, 0)} total stock
                  </p>
                </div>
                <div className="store-product-list-actions">
                  <button
                    type="button"
                    className="store-btn-ghost"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => setEditingProduct(product)}
                    style={{ padding: '6px 10px' }}
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            ))}

          <button
            type="button"
            className="store-btn-ghost"
            onClick={() => setReloadKey((k) => k + 1)}
            style={{ marginTop: '12px', width: '100%' }}
          >
            Refresh list
          </button>
        </div>
      </div>
    </div>
  );
}
