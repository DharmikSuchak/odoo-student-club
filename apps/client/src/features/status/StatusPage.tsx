import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { useApiHealth } from '@/hooks/use-api-health';

import styles from './StatusPage.module.css';

/**
 * Displays whether the API is reachable, with a useful failure state.
 * Legacy diagnostic view; currently not mounted in the application router.
 */
export function StatusPage() {
  const status = useApiHealth();

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logoMark} aria-hidden="true">
          <span className={styles.logoInner}>SC</span>
        </div>

        <h1 className={styles.title}>Student Club Platform</h1>
        <p className={styles.subtitle}>Service status</p>

        <div
          className={styles.statusBox}
          data-status={status.kind}
          role="status"
          aria-live="polite"
        >
          {status.kind === 'idle' && (
            <StatusRow
              icon={<LoaderCircle size={18} className={styles.spinner} />}
              label="Waiting…"
              muted
            />
          )}

          {status.kind === 'loading' && (
            <StatusRow
              icon={<LoaderCircle size={18} className={styles.spinner} />}
              label="Contacting API…"
              muted
            />
          )}

          {status.kind === 'ok' && (
            <>
              <StatusRow
                icon={<CheckCircle2 size={18} />}
                label="API reachable"
                variant="success"
              />
              <dl className={styles.details}>
                <div className={styles.detailRow}>
                  <dt>Environment</dt>
                  <dd>{status.data.environment}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Uptime</dt>
                  <dd>{status.data.uptime}s</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Server time</dt>
                  <dd>{new Date(status.data.timestamp).toLocaleTimeString()}</dd>
                </div>
              </dl>
            </>
          )}

          {status.kind === 'error' && (
            <>
              <StatusRow
                icon={<AlertCircle size={18} />}
                label="API not reachable"
                variant="danger"
              />
              <p className={styles.errorMessage}>{status.message}</p>
              <p className={styles.hint}>
                The service may be temporarily unavailable. Please try again shortly.
              </p>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              <p className={styles.hint}>
                Contact your club administrator if the problem continues.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatusRowProps {
  icon: ReactNode;
  label: string;
  muted?: boolean;
  variant?: 'success' | 'danger';
}

function StatusRow({ icon, label, muted = false, variant }: StatusRowProps) {
  return (
    <div
      className={[styles.statusRow, muted ? styles.muted : '', variant ? styles[variant] : '']
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}
