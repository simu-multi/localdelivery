import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  PHeading, PText, PButton, PSpinner,
} from '@porsche-design-system/components-react';
import TopBar from '../components/TopBar';
import { StatCard, StatusBadge } from '../components/Cards';

interface AdminStats {
  totalShops: number;
  totalRiders: number;
  activeDeliveries: number;
  completedDeliveries: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({ totalShops: 0, totalRiders: 0, activeDeliveries: 0, completedDeliveries: 0, revenue: 0 });
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);

    const [shopsRes, ridersRes, deliveriesRes] = await Promise.all([
      supabase.from('shops').select('*'),
      supabase.from('riders').select('*, profiles(full_name, mobile, is_active)'),
      supabase.from('deliveries').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const allDeliveries = deliveriesRes.data ?? [];
    const completed = allDeliveries.filter((d: any) => d.status === 'completed');
    const revenue = completed.length * 8;

    setShops(shopsRes.data ?? []);
    setRiders(ridersRes.data ?? []);
    setDeliveries(allDeliveries);
    setStats({
      totalShops: (shopsRes.data ?? []).length,
      totalRiders: (ridersRes.data ?? []).length,
      activeDeliveries: allDeliveries.filter((d: any) => ['pending','assigned','picked_up','arriving'].includes(d.status)).length,
      completedDeliveries: completed.length,
      revenue,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <PSpinner size="large" aria={{ 'aria-label': 'Loading' }} />
      </div>
    );
  }

  const sections = [
    { key: 'overview', label: 'Overview' },
    { key: 'shops', label: 'Shops' },
    { key: 'riders', label: 'Riders' },
    { key: 'deliveries', label: 'Deliveries' },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-8">
      <TopBar title="Admin Panel" />

      <div className="p-fluid-md space-y-fluid-sm">
        <div className="flex items-center justify-between">
          <PHeading size="medium" tag="h2">Admin Dashboard</PHeading>
          <PButton variant="secondary" icon="refresh" onClick={loadData}>Refresh</PButton>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {sections.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                activeSection === s.key
                  ? 'text-white'
                  : 'bg-surface text-contrast-medium border border-contrast-low'
              }`}
              style={activeSection === s.key ? { background: '#006FFF' } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <div className="space-y-fluid-sm">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Shops" value={stats.totalShops} accent="#006FFF" />
              <StatCard label="Total Riders" value={stats.totalRiders} accent="#AF52DE" />
              <StatCard label="Active Deliveries" value={stats.activeDeliveries} accent="#FF9500" />
              <StatCard label="Completed" value={stats.completedDeliveries} accent="#34C759" />
            </div>

            <div className="rounded-[16px] p-fluid-sm" style={{ background: 'linear-gradient(135deg,#006FFF,#0044CC)', boxShadow: '0px 4px 16px rgba(0,111,255,.25)' }}>
              <PText size="x-small" style={{ color: 'rgba(255,255,255,.7)' }}>Platform Revenue</PText>
              <span className="text-3xl font-bold text-white block mt-1">₹{stats.revenue}</span>
              <PText size="x-small" style={{ color: 'rgba(255,255,255,.7)' }}>₹8 commission × {stats.completedDeliveries} deliveries</PText>
            </div>

            <div>
              <PText size="small" weight="semi-bold" className="mb-2">Recent Deliveries</PText>
              <div className="space-y-2">
                {deliveries.slice(0, 10).map((d: any) => (
                  <div key={d.id} className="bg-surface rounded-[12px] px-3 py-2.5 flex items-center justify-between" style={{ boxShadow: '0px 2px 6px rgba(0,0,0,.06)' }}>
                    <div className="min-w-0 flex-1">
                      <PText size="small" className="truncate">{d.customer_name}</PText>
                      <PText size="x-small" className="text-contrast-medium truncate">{d.delivery_address}</PText>
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-1">
                      <StatusBadge status={d.status} />
                      <PText size="x-small" className="text-contrast-medium">₹{d.charge}</PText>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'shops' && (
          <div className="space-y-2">
            <PText size="small" weight="semi-bold">{shops.length} shops registered</PText>
            {shops.map((s: any) => (
              <div key={s.id} className="bg-surface rounded-[16px] p-fluid-sm" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
                <div className="flex items-center justify-between">
                  <PText weight="semi-bold">{s.name}</PText>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.is_active ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#F8D7DA] text-[#721C24]'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <PText size="small" className="text-contrast-medium">{s.address || 'No address'}</PText>
                <PText size="x-small" className="text-contrast-medium">{new Date(s.created_at).toLocaleDateString()}</PText>
              </div>
            ))}
            {shops.length === 0 && <PText className="text-contrast-medium">No shops yet</PText>}
          </div>
        )}

        {activeSection === 'riders' && (
          <div className="space-y-2">
            <PText size="small" weight="semi-bold">{riders.length} riders registered</PText>
            {riders.map((r: any) => (
              <div key={r.id} className="bg-surface rounded-[16px] p-fluid-sm" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
                <div className="flex items-center justify-between">
                  <PText weight="semi-bold">{r.profiles?.full_name ?? 'Unknown'}</PText>
                  <div className="flex gap-1">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.is_online ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#F8D7DA] text-[#721C24]'}`}>
                      {r.is_online ? 'Online' : 'Offline'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.is_verified ? 'bg-[#CCE5FF] text-[#004085]' : 'bg-[#FFF3CD] text-[#856404]'}`}>
                      {r.is_verified ? 'KYC ✓' : 'KYC Pending'}
                    </span>
                  </div>
                </div>
                <PText size="small" className="text-contrast-medium">{r.profiles?.mobile ?? ''}</PText>
              </div>
            ))}
            {riders.length === 0 && <PText className="text-contrast-medium">No riders yet</PText>}
          </div>
        )}

        {activeSection === 'deliveries' && (
          <div className="space-y-2">
            <PText size="small" weight="semi-bold">{deliveries.length} total deliveries</PText>
            {deliveries.map((d: any) => (
              <div key={d.id} className="bg-surface rounded-[16px] p-fluid-sm" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <PText weight="semi-bold" className="truncate">{d.customer_name}</PText>
                    <PText size="x-small" className="text-contrast-medium truncate">{d.delivery_address}</PText>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className="flex gap-4 mt-1">
                  <PText size="x-small">📏 {d.distance_km} km</PText>
                  <PText size="x-small">₹{d.charge}</PText>
                  <PText size="x-small" className="text-contrast-medium">{new Date(d.created_at).toLocaleDateString()}</PText>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
