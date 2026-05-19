import { useEffect, type ReactNode } from 'react';

/**
 * Shared Modal shell matching the Claude Design PromptLab.html mockup —
 * `.modal-overlay` (backdrop + blur) wrapping `.modal` (head / body /
 * foot). Backdrop click + Esc dismiss; the overlay is always mounted so
 * the CSS fadeIn / modalIn keyframes can play on enter.
 */

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  headerActions: ReactNode;
  children: ReactNode;
  /** Optional override for the max-width — the design uses 600 px by
   * default but bumps the New Batch Test modal up to 640 px. */
  maxWidth?: number;
};

export function Modal({
  open,
  onClose,
  title,
  sub,
  headerActions,
  children,
  maxWidth,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div
      className={`modal-overlay ${open ? '' : 'hidden'}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-sub">{sub}</div>
          </div>
          <div className="modal-actions">{headerActions}</div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
