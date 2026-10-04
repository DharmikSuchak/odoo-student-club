import { useEffect, type ReactNode } from 'react';

interface DialogProps {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}

export function Dialog({ children, titleId, onClose, busy = false, className = '' }: DialogProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [busy, onClose]);

  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`ui-dialog-content ${className}`}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        aria-busy={busy}
      >
        {children}
      </div>
    </div>
  );
}
