import { Modal } from './modal';

/**
 * In-app replacement for `window.confirm`. The native dialog prefixes
 * its title with the origin ("promptlab-….run.app says") and there is no
 * web API to change that — the only way to say "PromptLab" is to draw
 * the dialog ourselves.
 */

type ConfirmDialogProps = {
  open: boolean;
  /** What is being deleted, e.g. "prompt" — becomes "Delete prompt?". */
  noun: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  noun,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Delete ${noun}?`}
      sub=""
      maxWidth={420}
      headerActions={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="page-sub" style={{ padding: '4px 0 8px' }}>
        This action can't be undone.
      </div>
    </Modal>
  );
}
