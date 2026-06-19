import { useState, useEffect } from 'react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
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
    let velocity = 8;
    const step = () => {
      const c = document.documentElement.scrollTop || document.body.scrollTop;
      if (c <= 0) return;
      // accelerate velocity and move upwards
      velocity = Math.min(2000, velocity * 1.18 + 1);
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
      className="fixed bottom-6 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all focus:outline-none focus:ring-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V6" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}