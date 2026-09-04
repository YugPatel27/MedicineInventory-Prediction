import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from './Icons';

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    ring: 'border-emerald-200',
    bar: 'bg-emerald-500',
    iconColor: 'text-emerald-600',
    text: 'text-emerald-900',
  },
  danger: {
    icon: XCircle,
    bg: 'bg-rose-50',
    ring: 'border-rose-200',
    bar: 'bg-rose-500',
    iconColor: 'text-rose-600',
    text: 'text-rose-900',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    ring: 'border-amber-200',
    bar: 'bg-amber-500',
    iconColor: 'text-amber-600',
    text: 'text-amber-900',
  },
  info: {
    icon: Info,
    bg: 'bg-emerald-50',
    ring: 'border-emerald-200',
    bar: 'bg-emerald-500',
    iconColor: 'text-emerald-600',
    text: 'text-emerald-900',
  },
};

export function Alert({ type = 'info', title, children }) {
  const v = VARIANTS[type] || VARIANTS.info;
  const Icon = v.icon;

  return (
    <div role="alert" className={`relative overflow-hidden rounded-2xl border ${v.ring} ${v.bg} pl-5 pr-4 py-3.5 text-sm ${v.text}`}>
      <span className={`absolute left-0 top-0 h-full w-1.5 ${v.bar}`} aria-hidden />
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${v.iconColor}`} />
        <div>
          {title && <div className="font-semibold">{title}</div>}
          <div className={title ? 'mt-1 leading-6' : 'leading-6'}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default Alert;
