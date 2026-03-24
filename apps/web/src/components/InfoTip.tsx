import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

/**
 * InfoTip - A tooltip triggered by tapping a question-mark icon.
 *
 * Uses createPortal + fixed positioning so it is never clipped by
 * parent overflow:hidden containers.  Supports both mouse and touch.
 * Prefers positioning BELOW the button (scrolls into view on mobile).
 */
export default function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [above, setAbove] = useState(false);

  // Position the tooltip relative to the button
  const reposition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const tipW = 192; // w-48 = 12rem
    const tipH = 80; // estimated max height
    const pad = 8;

    // Horizontal: center on button, clamp to viewport
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipW - pad));

    // Vertical: prefer BELOW (into the user's view), fall back to above
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > tipH + pad) {
      // Enough room below - show below
      setAbove(false);
      setStyle({ position: 'fixed', top: rect.bottom + pad, left });
    } else {
      // Not enough room below - show above
      setAbove(true);
      setStyle({ position: 'fixed', top: rect.top - pad, left, transform: 'translateY(-100%)' });
    }
  }, []);

  // Open / close
  const toggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShow(prev => !prev);
  }, []);

  // Reposition when shown
  useEffect(() => {
    if (!show) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [show, reposition]);

  // Click-outside to dismiss (mouse + touch)
  useEffect(() => {
    if (!show) return;
    function dismiss(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        tipRef.current && !tipRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setShow(false);
      }
    }
    // Small delay so the current tap's synthetic mousedown doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener('mousedown', dismiss);
      document.addEventListener('touchstart', dismiss);
    }, 10);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
  }, [show]);

  // Auto-dismiss after 5 seconds on mobile (no hover to dismiss)
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(id);
  }, [show]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="opacity-50 hover:opacity-80 transition-opacity inline-flex items-center"
        type="button"
        aria-label="More info"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show &&
        createPortal(
          <div
            ref={tipRef}
            className="z-[9999] w-48 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-xl animate-fade-in"
            style={style}
          >
            {text}
            {/* Arrow */}
            {above ? (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900"
                style={{ top: '100%' }}
              />
            ) : (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-slate-900"
                style={{ bottom: '100%' }}
              />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
