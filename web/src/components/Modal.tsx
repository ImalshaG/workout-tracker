import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  /** Called on Escape. Callers decide whether closing is allowed right now. */
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Modal built on <dialog>: focus trapping, Escape and returning focus to the opener come from the browser.
 * Children mount only while open, so their state starts fresh each time. After opening, focus moves to the
 * first element marked `data-autofocus`.
 */
export function Modal({ open, onClose, labelledBy, className = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      // Children unmount before this runs, so the browser's own focus restore may not kick in.
      openerRef.current?.focus();
      openerRef.current = null;
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={
        'm-auto rounded-lg bg-white p-6 text-zinc-900 shadow-xl backdrop:bg-black/40 ' +
        'dark:bg-zinc-900 dark:text-zinc-100 ' +
        className
      }
    >
      {open && children}
    </dialog>
  );
}
