import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}

/** Renders a modal with native focus containment; busy dialogs stay open during writes.
 * @param props Dialog content, accessible title, dismissal handler and optional busy state.
 * @returns A modal dialog that restores focus to its trigger on close.
 */
export function Dialog({ children, titleId, onClose, busy = false, className = '' }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      // React may remove the dialog before native close restores its trigger.
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    // Native dialog handles keyboard dismissal through onCancel; clicks here dismiss only its backdrop.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={`ui-dialog ${className}`}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
      }}
    >
      {children}
    </dialog>
  );
}
