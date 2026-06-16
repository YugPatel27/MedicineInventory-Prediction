// Text-only brand mark to avoid image assets and watermarks
export function BrandMark({ compact = false, showText = true, className = '' }) {
  const boxClass = compact
    ? 'h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold'
    : 'h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={boxClass} aria-hidden>
        <img src="/favicon.svg" alt="MediStock logo" className="h-6 w-6 rounded-lg object-contain" />
      </div>

      {showText && (
        <div>
          <p className="text-lg font-semibold leading-none tracking-[0.2em] text-primary">MediStock</p>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mt-1">Medicine stock intelligence</p>
        </div>
      )}
    </div>
  );
}
