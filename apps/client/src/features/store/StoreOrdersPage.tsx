/**
 * StoreOrdersPage — /merchandise/orders
 *
 * Member order history view:
 *   - Lists all orders placed by the authenticated user, newest first.
 *   - Shows item name, size, price, status badge, and order date.
 *   - Pending-payment orders include a clear notice that payment has
 *     NOT been collected (same labelling pattern as memberships).
 *   - Loading skeleton, error, and empty states.
 */
import { AlertCircle, ArrowLeft, Info, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { ApiError, StoreOrder } from '../../lib/api-client';
import { apiListMyOrders } from '../../lib/api-client';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function OrderStatusBadge({ status }: { status: StoreOrder['status'] }) {
  const labels: Record<StoreOrder['status'], string> = {
    pending_payment: 'Pending payment',
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`store-badge store-badge--${status.replace('_payment', '')}`}>
      {labels[status]}
    </span>
  );
}

function OrderRowSkeleton() {
  return (
    <tr aria-hidden="true">
      {[1, 2, 3, 4, 5].map((col) => (
        <td key={col}>
          <div
            className="store-skeleton-line store-skeleton-line--medium"
            style={{ height: '12px' }}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Authenticated member's order history, with payment-pending notices.
 */
export function StoreOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const res = await apiListMyOrders();
        if (!cancelled) setOrders(res.orders);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load orders.');
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

  const pendingCount = orders.filter((o) => o.status === 'pending_payment').length;

  return (
    <div className="store-page">
      <Link to="/merchandise" className="store-back-link">
        <ArrowLeft size={16} />
        Back to store
      </Link>

      <div className="store-heading-row">
        <div>
          <h1 className="store-title">My Orders</h1>
          <p className="store-subtitle">Your merchandise order history.</p>
        </div>
      </div>

      {/* Pending payment notice — mirrors membership flow */}
      {!isLoading && pendingCount > 0 && (
        <div className="store-notice store-notice--warning" role="note">
          <Info size={18} aria-hidden="true" />
          <span>
            <strong>
              {pendingCount} order{pendingCount > 1 ? 's' : ''} awaiting payment.
            </strong>{' '}
            Payment collection is not yet integrated. A treasurer or organizer will contact you to
            arrange payment. This is the same pending-payment flow used for memberships and event
            tickets.
          </span>
        </div>
      )}

      {isLoading && (
        <div className="store-table-container" role="status" aria-label="Loading orders">
          <table className="store-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Size</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((key) => (
                <OrderRowSkeleton key={key} />
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {!isLoading && error === null && orders.length === 0 && (
        <div className="store-empty">
          <span className="store-empty-icon" aria-hidden="true">
            <ShoppingBag size={40} />
          </span>
          <h2 className="store-empty-title">No orders yet</h2>
          <p className="store-empty-body">
            You haven&apos;t placed any orders. Browse the store to get started.
          </p>
          <Link to="/merchandise" className="store-btn-ghost" style={{ marginTop: '16px' }}>
            Browse store
          </Link>
        </div>
      )}

      {!isLoading && error === null && orders.length > 0 && (
        <div className="store-table-container">
          <table className="store-table" aria-label="Order history">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Size</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Ordered</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <span className="store-table-product-name">{order.itemName}</span>
                  </td>
                  <td>{order.size}</td>
                  <td>{formatMoney(order.totalCents, order.currency)}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
