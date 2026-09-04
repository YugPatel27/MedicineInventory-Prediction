// Text-only brand mark to avoid image assets and watermarks
export function BrandMark({ compact = false, showText = true, className = '', theme = 'light' }) {
  const isDark = theme === 'dark';

  const boxClass = `${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-xl flex items-center justify-center font-bold transition-transform duration-200 hover:scale-105 ${
    isDark ? 'bg-white/15 text-white ring-1 ring-white/20' : 'bg-primary/10 text-primary'
  }`;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={boxClass} aria-hidden>
        <img src="/favicon.svg" alt="MediStock logo" className="h-9 w-9 rounded-lg object-contain" />
      </div>

      {showText && (
        <div>
          <p className={`text-lg font-semibold leading-none tracking-[0.15em] ${isDark ? 'text-white' : 'text-primary'}`}>MediStock</p>
          <p className={`text-[10px] uppercase tracking-[0.3em] mt-1.5 ${isDark ? 'text-emerald-100/70' : 'text-muted-foreground'}`}>Medicine Stock Intelligence</p>
        </div>
      )}
    </div>
  );
}
