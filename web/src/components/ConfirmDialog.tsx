import { TriangleAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './ui';

interface Props {
  open: boolean;
  message: string;
  /** Omit to show the message with just a Close button (e.g. when the action can't proceed). */
  confirmLabel?: string | undefined;
  pendingLabel?: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, message, confirmLabel, pendingLabel = 'Deleting…', pending, onConfirm, onCancel }: Props) {
  return (
    <Modal
      open={open}
      onClose={() => !pending && onCancel()}
      labelledBy="confirm-message"
      className="w-[min(26rem,calc(100%-2rem))]"
    >
      <div className="flex gap-3">
        {confirmLabel && <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />}
        <p id="confirm-message" className="text-base">
          {message}
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel} disabled={pending} data-autofocus>
          {confirmLabel ? 'Cancel' : 'Close'}
        </Button>
        {confirmLabel && (
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  );
}
