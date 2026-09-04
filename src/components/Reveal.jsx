import { useEffect, useRef, useState } from 'react';

/**
 * Wrap any block of content to have it fade/slide in as it scrolls into
 * view, and fade back out if it scrolls out of view — so scrolling back up
 * and back down re-plays the entrance instead of leaving it revealed once.
 */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div', threshold = 0.15 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
