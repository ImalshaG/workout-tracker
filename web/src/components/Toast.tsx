import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

const ToastContext = createContext<(message: string) => void>(() => {});
const DISMISS_MS = 4000;
const MAX_TOASTS = 3;

/** Success confirmations only; errors stay inline where they happened. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const nextId = useRef(1);
  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-(MAX_TOASTS - 1)), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DISMISS_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted so screen readers pick up new messages. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg motion-safe:animate-[toast-in_.2s_ease-out] dark:bg-stone-100 dark:text-stone-900">
            <CircleCheck className="size-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
