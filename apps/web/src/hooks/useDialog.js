import { useEffect, useRef } from 'react';

export function useDialog(onClose, enabled = true) {
  const ref = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(ref.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]') || []).filter(element => element.getClientRects().length && !element.closest('[inert]'));
    controls()[0]?.focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
      if (event.key !== 'Tab') return;
      const elements = controls(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const dialog = ref.current;
    dialog?.addEventListener('keydown', key);
    return () => { dialog?.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [enabled]);
  return ref;
}
