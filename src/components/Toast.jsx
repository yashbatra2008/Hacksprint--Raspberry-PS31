import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

const GLYPH = { safe: '✓', danger: '✕', warn: '!', info: '›' };

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = `t${(seq += 1)}`;
      const entry = {
        id,
        tone: toast.tone ?? 'info',
        title: toast.title ?? 'SYSTEM',
        message: toast.message ?? '',
        lines: toast.lines ?? [],
        duration: toast.duration ?? 5200,
      };
      setToasts((list) => [...list.slice(-3), entry]);
      if (entry.duration > 0) {
        setTimeout(() => dismiss(id), entry.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss, toasts }), [push, dismiss, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <div className="toast-head">
              <span className="toast-glyph mono" aria-hidden="true">
                {GLYPH[t.tone] ?? '›'}
              </span>
              <span className="mono toast-title">[ {t.title} ]</span>
              <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                ✕
              </button>
            </div>
            {t.message ? <p className="toast-msg">{t.message}</p> : null}
            {t.lines.length ? (
              <div className="stack gap-2">
                {t.lines.map((line, i) => (
                  <span key={i} className="mono toast-line">
                    {line}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
