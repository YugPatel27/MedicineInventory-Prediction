import { useEffect, useRef, useState } from 'react';

export function PageHeader({ eyebrow, title, description, image, imageAlt = '', actions, tone = 'green', imageClassName = '' }) {
  const [settled, setSettled] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Reset the failed-image fallback whenever the page swaps in a different
  // background, so navigating away and back doesn't stay stuck on the
  // gradient-only fallback for an image that actually loads fine.
  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  const overlay =
    tone === 'slate'
      ? 'from-slate-950/90 via-slate-900/72 to-emerald-900/48'
      : 'from-emerald-950/90 via-emerald-900/72 to-emerald-800/48';

  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] shadow-lg">
      <div className={`absolute inset-0 ${tone === 'slate' ? 'bg-slate-900' : 'bg-emerald-900'}`} />
      {!imageFailed && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={image}
            alt={imageAlt}
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover brightness-110 saturate-110 transition-transform duration-[1400ms] ease-out ${imageClassName} ${
              settled ? 'scale-100' : 'scale-[1.12]'
            }`}
          />
        </div>
      )}
      <div className={`absolute inset-0 z-[1] bg-gradient-to-t ${overlay}`} />

      <div
        className={`relative z-10 flex flex-col gap-6 p-6 text-white transition-all duration-700 ease-out md:p-8 ${
          settled ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="max-w-3xl rounded-2xl bg-emerald-950/55 p-4 shadow-lg ring-1 ring-white/10 backdrop-blur-[2px] md:p-5">
          <p className="eyebrow-tag text-emerald-200">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight drop-shadow-md md:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90 drop-shadow-sm">{description}</p>}
        </div>
        {actions && <div className="w-full border-t border-white/15 pt-5">{actions}</div>}
      </div>
    </section>
  );
}

export default PageHeader;
