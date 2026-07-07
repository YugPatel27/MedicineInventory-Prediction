import { useEffect } from 'react';
import { createOrUpdateCanonical, createOrUpdateMeta } from './seo-utils.js';

export function SEO({ title, description, url }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) createOrUpdateMeta('description', description);
    createOrUpdateCanonical(url || (typeof window !== 'undefined' ? window.location.href : ''));
  }, [title, description, url]);
  return null;
}