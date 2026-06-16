import React from 'react';

export function Alert({ type = 'info', title, children }) {
  const styles = {
    success: {
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      color: 'hsl(var(--card-foreground))',
    },
    danger: {
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      color: 'hsl(var(--card-foreground))',
    },
    info: {
      backgroundColor: 'hsl(var(--primary) / 0.12)',
      borderColor: 'hsl(var(--primary) / 0.16)',
      color: 'hsl(var(--primary-foreground))',
    },
  };

  const s = styles[type] || styles.info;

  return (
    <div role="alert" className="rounded-2xl border px-4 py-3 text-sm" style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, color: s.color }}>
      {title && <div className="font-semibold">{title}</div>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default Alert;
