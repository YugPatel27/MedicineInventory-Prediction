import { useState, useEffect } from 'react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      if (scrollPos > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    // Accelerating scroll: increase velocity each frame for a snappier feel
    let velocity = 14;
    const step = () => {
      const c = document.documentElement.scrollTop || document.body.scrollTop;
      if (c <= 0) return;
      // accelerate velocity and move upwards
      velocity = Math.min(3200, velocity * 1.28 + 1);
      const next = Math.max(0, Math.round(c - velocity));
      window.scrollTo(0, next);
      if (next > 0) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      // Explicit, opaque dark-green + white icon with its own border/shadow
      // so the button stays visible over any page background or layout,
      // instead of relying on theme variables that can resolve to a
      // transparent/washed-out color in some contexts.
      style={{ backgroundColor: '#065f46' }}
      className="fixed bottom-6 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white shadow-lg shadow-black/20 transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V6" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}