export function createOrUpdateMeta(name, content) {
  if (typeof document === 'undefined') return;

  let meta = document.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

export function createOrUpdateCanonical(url) {
  if (typeof document === 'undefined') return;

  let canonical = document.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }

  canonical.setAttribute('href', url || '');
}
