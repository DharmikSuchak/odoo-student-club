import { useApiHealth } from '@/hooks/use-api-health';

import styles from './StatusPage.module.css';

/**
 * Displays whether the API is reachable, with a useful failure state.
 * This is the scaffold's single page — replaced in Phase 1 with the real app shell.
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
        <p className={styles.subtitle}>Scaffold — Phase 0</p>

        <div className={styles.statusBox} data-status={status.kind}>
          {status.kind === 'idle' && <StatusRow icon="○" label="Waiting…" muted />}

          {status.kind === 'loading' && <StatusRow icon="◌" label="Contacting API…" muted />}

          {status.kind === 'ok' && (
            <>
              <StatusRow icon="✓" label="API reachable" variant="success" />
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
              <StatusRow icon="✕" label="API not reachable" variant="danger" />
              <p className={styles.errorMessage}>{status.message}</p>
              <p className={styles.hint}>
                Start the API with <code className={styles.code}>npm run dev -w apps/server</code>{' '}
                and ensure your <code className={styles.code}>.env</code> is copied from{' '}
                <code className={styles.code}>.env.example</code>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-component ──────────────────────────────────────────── */

interface StatusRowProps {
  icon: string;
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
