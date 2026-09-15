import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: string;
}

export function StatCard({ label, value, icon, accent = '#006FFF' }: StatCardProps) {
  return (
    <div
      className="bg-surface rounded-[16px] p-fluid-sm flex flex-col gap-2"
      style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-contrast-medium font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accent + '18' }}>
            {icon}
          </div>
        )}
      </div>
      <span className="text-2xl font-bold" style={{ color: accent }}>{value}</span>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: '#FFF3CD', color: '#856404' },
  assigned: { label: 'Assigned', bg: '#CCE5FF', color: '#004085' },
  picked_up: { label: 'Picked Up', bg: '#D4EDDA', color: '#155724' },
  arriving: { label: 'Arriving', bg: '#D1ECF1', color: '#0C5460' },
  completed: { label: 'Completed', bg: '#D4EDDA', color: '#155724' },
  cancelled: { label: 'Cancelled', bg: '#F8D7DA', color: '#721C24' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, bg: '#eee', color: '#333' };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

interface DeliveryCardProps {
  customerName: string;
  address: string;
  charge: number;
  status: string;
  distance: number;
  onPress?: () => void;
  children?: ReactNode;
}

export function DeliveryCard({ customerName, address, charge, status, distance, onPress, children }: DeliveryCardProps) {
  return (
    <div
      className="bg-surface rounded-[16px] p-fluid-sm cursor-pointer hover:shadow-lg transition-shadow"
      style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}
      onClick={onPress}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-primary truncate">{customerName}</p>
          <p className="text-xs text-contrast-medium truncate mt-0.5">{address}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-4 text-xs text-contrast-medium">
        <span>📍 {distance.toFixed(1)} km</span>
        <span className="font-semibold text-[#006FFF]">₹{charge}</span>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
