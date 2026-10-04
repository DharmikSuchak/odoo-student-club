import { AlertCircle, Package, ShoppingBag, Edit2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { ApiError, MerchandiseProduct } from '../../lib/api-client';
import { apiListProducts } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import './store.css';

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

function StoreSkeleton() {
  return (
    <div className="store-product-grid" role="status" aria-label="Loading products">
      <span className="sr-only">Loading products…</span>
      {[1, 2, 3].map((key) => (
        <div key={key} className="store-skeleton">
          <div className="store-skeleton-line store-skeleton-line--short" />
          <div className="store-skeleton-line store-skeleton-line--medium" />
          <div className="store-skeleton-line store-skeleton-line--full" />
          <div className="store-skeleton-line store-skeleton-line--medium" />
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product, isOrganizer }: { product: MerchandiseProduct; isOrganizer: boolean }) {
  const navigate = useNavigate();
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
  const hasStock = totalStock > 0;

  return (
    <button
      type="button"
      className="store-product-card"
      onClick={() => navigate(`/merchandise/${product._id}`)}
      style={{ cursor: 'pointer', position: 'relative', textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0 }}
      aria-label={`View ${product.name}`}
    >
      <div className="store-product-card-header">
        <div className="store-product-icon" aria-hidden="true">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
          ) : (
            <ShoppingBag size={20} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span className="store-product-price">
            {formatMoney(product.priceCents, product.currency)}
          </span>
          {isOrganizer && (
            <button 
              className="store-btn-ghost" 
              style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: 'unset', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/merchandise/manage');
              }}
              title="Edit in Manage Products"
            >
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>
      </div>

      <span className="store-product-name">{product.name}</span>

      <div className="store-variant-pills" aria-label="Available sizes">
        {product.variants.map((variant) => (
          <span
            key={variant.size}
            className={`store-variant-pill${variant.stockQuantity === 0 ? ' store-variant-pill--out' : ''}`}
            title={
              variant.stockQuantity === 0
                ? 'Out of stock'
                : `${variant.stockQuantity.toString()} left`
            }
          >
            {variant.size}
            {variant.stockQuantity === 0 && <AlertCircle size={10} aria-label="Out of stock" />}
          </span>
        ))}
      </div>

      {!hasStock && (
        <span
          className="store-badge store-badge--cancelled"
          role="status"
          aria-label="All sizes out of stock"
        >
          All sizes sold out
        </span>
      )}
    </button>
  );
}

export function StorePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<MerchandiseProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isOrganizer = user?.role === 'officer' || user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const res = await apiListProducts();
        if (!cancelled) setProducts(res.products);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load products.');
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

  return (
    <div className="store-page">
      <div className="store-heading-row">
        <div>
          <h1 className="store-title">Club Store</h1>
          <p className="store-subtitle">Browse and order official club merchandise.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {user?.role !== 'admin' && (
            <Link to="/merchandise/orders" className="store-btn-ghost">
              My Orders
            </Link>
          )}
          {isOrganizer && (
            <Link to="/merchandise/manage" className="store-btn-ghost">
              Manage Products
            </Link>
          )}
        </div>
      </div>

      {isLoading && <StoreSkeleton />}

      {!isLoading && error !== null && (
        <div className="store-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{error}</p>
          <button
            type="button"
            className="store-btn-ghost"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && error === null && products.length === 0 && (
        <div className="store-empty">
          <span className="store-empty-icon" aria-hidden="true">
            <Package size={40} />
          </span>
          <h2 className="store-empty-title">No products yet</h2>
          <p className="store-empty-body">
            {isOrganizer
              ? 'Add your first product in the product manager.'
              : 'The club store is empty for now. Check back later.'}
          </p>
          {isOrganizer && (
            <Link
              to="/merchandise/manage"
              className="store-btn-ghost"
              style={{ marginTop: '16px' }}
            >
              Add a product
            </Link>
          )}
        </div>
      )}

      {!isLoading && error === null && products.length > 0 && (
        <div className="store-product-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} isOrganizer={isOrganizer} />
          ))}
        </div>
      )}
    </div>
  );
}
