import { useEffect } from 'react';

export function SEO({ title, description, url }) {
  useEffect(() => {
    document.title = title;
    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', description);
      else {
        const tag = document.createElement('meta');
        tag.name = 'description';
        tag.content = description;
        document.head.appendChild(tag);
      }
    }
    if (url) {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = url;
      else {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = url;
        document.head.appendChild(link);
      }
    }
  }, [title, description, url]);
  return null;
}