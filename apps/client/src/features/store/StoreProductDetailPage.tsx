import { AlertCircle, ArrowLeft, CheckCircle, Info, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ApiError, MerchandiseProduct, MerchandiseVariant } from '../../lib/api-client';
import { apiGetProduct, apiPlaceOrder } from '../../lib/api-client';

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

function SizeButton({
  variant,
  isSelected,
  onSelect,
}: {
  variant: MerchandiseVariant;
  isSelected: boolean;
  onSelect: (size: string) => void;
}) {
  const isOutOfStock = variant.stockQuantity === 0;
  let className = 'store-size-btn';
  if (isSelected) className += ' store-size-btn--selected';
  else if (isOutOfStock) className += ' store-size-btn--out';

  return (
    <button
      type="button"
      className={className}
      disabled={isOutOfStock}
      aria-pressed={isSelected}
      aria-label={
        isOutOfStock
          ? `${variant.size} — out of stock`
          : `${variant.size} — ${variant.stockQuantity.toString()} left`
      }
      onClick={() => {
        if (!isOutOfStock) onSelect(variant.size);
      }}
    >
      {variant.size}
      {isOutOfStock && <span className="store-out-tag">Out</span>}
    </button>
  );
}

function ProductSkeleton() {
  return (
    <div className="store-skeleton" role="status" aria-label="Loading product">
      <span className="sr-only">Loading…</span>
      <div className="store-skeleton-line store-skeleton-line--short" />
      <div className="store-skeleton-line store-skeleton-line--medium" />
      <div className="store-skeleton-line store-skeleton-line--full" />
      <div className="store-skeleton-line store-skeleton-line--medium" />
    </div>
  );
}

export function StoreProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<MerchandiseProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (productId === undefined) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function load() {
      try {
        // productId is checked above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const res = await apiGetProduct(productId!);
        if (!cancelled) setProduct(res.product);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setLoadError(apiErr.message ?? 'Failed to load product.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handlePlaceOrder() {
    if (productId === undefined || selectedSize === null) return;
    setIsOrdering(true);
    setOrderError(null);
    try {
      const res = await apiPlaceOrder(productId, selectedSize);
      setOrderId(res.order._id);
      const refreshed = await apiGetProduct(productId);
      setProduct(refreshed.product);
    } catch (err) {
      const apiErr = err as ApiError;
      setOrderError(apiErr.message ?? 'Failed to place order. Please try again.');
    } finally {
      setIsOrdering(false);
    }
  }

  if (isLoading) {
    return (
      <div className="store-page">
        <Link to="/merchandise" className="store-back-link">
          <ArrowLeft size={16} />
          Back to store
        </Link>
        <ProductSkeleton />
      </div>
    );
  }

  if (loadError !== null || product === null) {
    return (
      <div className="store-page">
        <Link to="/merchandise" className="store-back-link">
          <ArrowLeft size={16} />
          Back to store
        </Link>
        <div className="store-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{loadError ?? 'Product not found.'}</p>
        </div>
      </div>
    );
  }

  const currentVariant = product.variants.find((v) => v.size === selectedSize);
  const isCurrentSizeAvailable = currentVariant !== undefined && currentVariant.stockQuantity > 0;
  const canOrder = selectedSize !== null && isCurrentSizeAvailable && !isOrdering;

  return (
    <div className="store-page">
      <Link to="/merchandise" className="store-back-link">
        <ArrowLeft size={16} />
        Back to store
      </Link>

      <div className="store-detail-layout">
        <div className="store-detail-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div className="store-product-icon" aria-hidden="true">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h1 className="store-detail-title">{product.name}</h1>
              <span className="store-detail-price">
                {formatMoney(product.priceCents, product.currency)}
              </span>
            </div>
          </div>

          <p className="store-size-label">Available sizes</p>
          <div className="store-size-grid" role="group" aria-label="Size selection">
            {product.variants.map((variant) => (
              <SizeButton
                key={variant.size}
                variant={variant}
                isSelected={selectedSize === variant.size}
                onSelect={setSelectedSize}
              />
            ))}
          </div>

          {selectedSize !== null &&
            currentVariant !== undefined &&
            currentVariant.stockQuantity > 0 && (
              <p
                style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginBottom: '8px' }}
                aria-live="polite"
              >
                {currentVariant.stockQuantity} unit
                {currentVariant.stockQuantity !== 1 ? 's' : ''} left in size {selectedSize}
              </p>
            )}

          {product.variants.every((v) => v.stockQuantity === 0) && (
            <div className="store-notice store-notice--danger" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <span>All sizes are currently out of stock.</span>
            </div>
          )}
        </div>

        <div className="store-detail-card">
          {orderId !== null ? (
            <div>
              <div className="store-notice store-notice--success" role="status">
                <CheckCircle size={18} aria-hidden="true" />
                <span>
                  <strong>Order placed!</strong> Your order has been reserved.
                </span>
              </div>

              <div className="store-pending-callout" role="note">
                <strong>Payment pending: no money has been charged.</strong>
                This order is in <em>pending_payment</em> status. Payment collection is not yet
                integrated. A treasurer or organizer will contact you to complete payment. This flow
                follows the same pattern as ticket and membership purchases.
              </div>

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <Link
                  to="/merchandise/orders"
                  className="store-btn-primary"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  View my orders
                </Link>
                <Link
                  to="/merchandise"
                  className="store-btn-ghost"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--slate-800)',
                  marginBottom: '16px',
                }}
              >
                Order summary
              </h2>

              {selectedSize === null && (
                <p
                  style={{ color: 'var(--slate-500)', fontSize: '0.875rem', marginBottom: '16px' }}
                >
                  Select a size to continue.
                </p>
              )}

              {selectedSize !== null && (
                <div
                  className="store-detail-card"
                  style={{ marginBottom: '16px', padding: '12px 16px' }}
                >
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--slate-500)', paddingBottom: '8px' }}>Item</td>
                        <td
                          style={{
                            color: 'var(--slate-800)',
                            fontWeight: 600,
                            textAlign: 'right',
                            paddingBottom: '8px',
                          }}
                        >
                          {product.name}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--slate-500)', paddingBottom: '8px' }}>Size</td>
                        <td
                          style={{
                            color: 'var(--slate-800)',
                            fontWeight: 600,
                            textAlign: 'right',
                            paddingBottom: '8px',
                          }}
                        >
                          {selectedSize}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            color: 'var(--slate-700)',
                            fontWeight: 700,
                            borderTop: '1px solid var(--slate-200)',
                            paddingTop: '8px',
                          }}
                        >
                          Total
                        </td>
                        <td
                          style={{
                            color: 'var(--brand-600)',
                            fontWeight: 700,
                            textAlign: 'right',
                            borderTop: '1px solid var(--slate-200)',
                            paddingTop: '8px',
                          }}
                        >
                          {formatMoney(product.priceCents, product.currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {orderError !== null && (
                <div className="store-notice store-notice--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>{orderError}</span>
                </div>
              )}

              <div className="store-notice store-notice--info" role="note">
                <Info size={18} aria-hidden="true" />
                <span>
                  <strong>Note:</strong> This places a pending order only. No payment will be
                  processed now. Payment integration is not yet available.
                </span>
              </div>

              <button
                id="store-place-order-btn"
                type="button"
                className="store-btn-primary"
                disabled={!canOrder}
                aria-busy={isOrdering}
                onClick={() => void handlePlaceOrder()}
              >
                {isOrdering ? 'Placing order…' : 'Place order (pending payment)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
