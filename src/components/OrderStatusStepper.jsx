import { CheckCircle2, Clock3, Box, Truck, PackageCheck, XCircle } from './Icons';

const STEPS = [
  { key: 'Placed', label: 'Order Placed', icon: CheckCircle2 },
  { key: 'Confirmed', label: 'Confirmed', icon: Clock3 },
  { key: 'Processing', label: 'Processing', icon: Box },
  { key: 'Shipped', label: 'Shipped', icon: Truck },
  { key: 'Delivered', label: 'Delivered', icon: PackageCheck },
];

export function OrderStatusStepper({ status }) {
  if (status === 'Cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        <XCircle className="h-5 w-5" />
        This order has been cancelled.
      </div>
    );
  }

  const activeIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-start justify-between gap-1 overflow-x-auto py-2">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx <= activeIdx;
        const isCurrent = idx === activeIdx;
        return (
          <div key={step.key} className="flex flex-1 min-w-[84px] flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${idx === 0 ? 'opacity-0' : done ? 'bg-emerald-500' : 'bg-border'}`} />
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-white text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className={`h-0.5 flex-1 ${idx === STEPS.length - 1 ? 'opacity-0' : idx < activeIdx ? 'bg-emerald-500' : 'bg-border'}`} />
            </div>
            <span className={`mt-2 text-[11px] font-semibold ${done ? 'text-emerald-700' : 'text-muted-foreground'}`}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default OrderStatusStepper;
