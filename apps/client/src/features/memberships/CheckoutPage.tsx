import { CreditCard, AlertCircle, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { apiGetTiers, apiCreateCheckoutSession } from '../../lib/api-client';
import type { MembershipTier, ApiError } from '../../lib/api-client';

export function CheckoutPage() {
  const { tierId } = useParams();
  // const navigate = useNavigate();
  const [tier, setTier] = useState<MembershipTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiGetTiers();
        const found = res.tiers.find(t => t._id === tierId);
        if (found) {
          setTier(found);
        } else {
          setError('Membership tier not found.');
        }
      } catch {
        setError('Failed to load membership details.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [tierId]);



  const handleStripe = async () => {
    if (!tierId) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiCreateCheckoutSession(tierId);
      window.location.href = res.url;
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to initiate Stripe checkout.');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="ms-page">
        <p>Loading checkout...</p>
      </div>
    );
  }

  if (error || !tier) {
    return (
      <div className="ms-page">
        <div className="ms-error">
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-page" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '4rem' }}>
      <div className="ms-card" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Checkout</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Complete your membership purchase securely via Stripe.</p>
        </div>

        <div style={{ background: 'var(--color-bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 500 }}>{tier.name}</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>₹{(tier.priceCents / 100).toFixed(2)}</span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{tier.description}</p>
        </div>

        {error && (
          <div className="ms-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={24} />
            <p>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* <button 
            className="ms-btn ms-btn--primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: '#5f259f' }}
            onClick={() => void handlePay()}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : (
              <>
                <Smartphone size={20} />
                Pay with PhonePe / GPay (Mock)
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: '0.5rem 0' }}>or</div> */}

          <button 
            className="ms-btn ms-btn--primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: '#635BFF' }}
            onClick={() => void handleStripe()}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : (
              <>
                <CreditCard size={20} />
                Pay with Stripe Checkout
                <ExternalLink size={16} style={{ marginLeft: '0.25rem' }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
