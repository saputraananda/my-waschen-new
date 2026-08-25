import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * Resets scroll position to top whenever route or navigation state changes
 * (navigating back, forward, or direct link).
 */
export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation();

  useEffect(() => {
    const doScrollTop = () => {
      // 1. Reset window & document
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }

      // 2. Reset any custom scrollable container elements
      const scrollables = document.querySelectorAll('.overflow-y-auto, .overflow-auto, main, #root, body, html');
      scrollables.forEach(el => {
        if (el && (el.scrollTop > 0 || el.scrollLeft > 0)) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      });
    };

    doScrollTop();

    // Secondary triggers after render ticks to cover async component mounts
    const timer1 = setTimeout(doScrollTop, 0);
    const timer2 = setTimeout(doScrollTop, 50);
    const timer3 = setTimeout(doScrollTop, 150);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname, search, hash, key]);

  return null;
}
