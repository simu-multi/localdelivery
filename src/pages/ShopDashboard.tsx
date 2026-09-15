import { useState, useEffect, useCallback } from 'react';
import { supabase, calcDeliveryCharge } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Shop, Delivery, Wallet, WalletTransaction } from '../lib/supabase';
import {
  PHeading, PText, PButton, PInputText, PModal,
  PSpinner, PInlineNotification,
} from '@porsche-design-system/components-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { StatCard, DeliveryCard, StatusBadge } from '../components/Cards';
import AddressSearch from '../components/AddressSearch';
import MapView from '../components/MapView';
import { roadDistanceKm, type PlaceResult } from '../lib/maps';

const NAV_ITEMS = [
  { icon: 'home', label: 'Dashboard', tab: 'dashboard' },
  { icon: 'add', label: 'Book', tab: 'book' },
  { icon: 'card', label: 'Wallet', tab: 'wallet' },
  { icon: 'clock', label: 'History', tab: 'history' },
];

export default function ShopDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shop, setShop] = useState<Shop | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // Book delivery form
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [parcelDesc, setParcelDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<PlaceResult | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  const charge = calcDeliveryCharge(parseFloat(distanceKm) || 0);

  // Auto-calculate distance when delivery location is selected and shop has coordinates
  useEffect(() => {
    if (!deliveryLocation || !shop?.lat || !shop?.lng) return;
    let active = true;
    setDistanceLoading(true);
    roadDistanceKm({ lat: shop.lat, lng: shop.lng }, { lat: deliveryLocation.lat, lng: deliveryLocation.lng })
      .then((km) => {
        if (!active) return;
        if (km !== null) {
          setDistanceKm(km.toFixed(2));
        }
        setDistanceLoading(false);
      })
      .catch(() => { if (active) setDistanceLoading(false); });
    return () => { active = false; };
  }, [deliveryLocation, shop?.lat, shop?.lng]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [shopRes, walletRes] = await Promise.all([
      supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle(),
      supabase.from('wallets').select('*').eq('profile_id', user.id).maybeSingle(),
    ]);

    setShop(shopRes.data ?? null);
    setWallet(walletRes.data ?? null);

    if (shopRes.data) {
      const { data: deliveriesData } = await supabase
        .from('deliveries')
        .select('*')
        .eq('shop_id', shopRes.data.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setDeliveries(deliveriesData ?? []);
    }

    if (walletRes.data) {
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletRes.data.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setTransactions(txData ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleBookDelivery(e: React.FormEvent) {
    e.preventDefault();
    setBookingError('');
    const km = parseFloat(distanceKm);
    if (!km || km <= 0) { setBookingError('Enter a valid distance in KM'); return; }
    if (!shop) { setBookingError('Shop profile not set up'); return; }
    setConfirmOpen(true);
  }

  async function confirmBooking() {
    if (!shop || !wallet) return;
    const km = parseFloat(distanceKm);
    const fee = calcDeliveryCharge(km);

    if (wallet.balance < fee) {
      setConfirmOpen(false);
      setBookingError(`Insufficient wallet balance. Need ₹${fee}, have ₹${wallet.balance.toFixed(2)}`);
      return;
    }

    setBookingLoading(true);
    const { data: deliveryData, error: deliveryErr } = await supabase.from('deliveries').insert({
      shop_id: shop.id,
      customer_name: customerName,
      customer_mobile: customerMobile,
      pickup_address: shop.address,
      delivery_address: deliveryAddress,
      parcel_description: parcelDesc,
      notes: notes || null,
      distance_km: km,
      charge: fee,
      status: 'pending',
      delivery_lat: deliveryLocation?.lat ?? null,
      delivery_lng: deliveryLocation?.lng ?? null,
    }).select();

    if (deliveryErr) {
      setBookingError(deliveryErr.message);
      setConfirmOpen(false);
      setBookingLoading(false);
      return;
    }

    const { error: debitError } = await supabase.rpc('debit_wallet', {
      p_wallet_id: wallet.id,
      p_amount: fee,
      p_description: `Delivery charge for ${customerName}`,
      p_delivery_id: deliveryData?.[0]?.id,
    });

    if (debitError) {
      if (deliveryData?.[0]?.id) {
        await supabase.from('deliveries').delete().eq('id', deliveryData[0].id);
      }
      setBookingError(debitError.message.includes('Insufficient')
        ? `Insufficient wallet balance. Need ₹${fee}, have ₹${wallet.balance.toFixed(2)}`
        : 'Could not process the wallet charge. Please try again.');
      setConfirmOpen(false);
      setBookingLoading(false);
      return;
    }

    setConfirmOpen(false);
    setBookingSuccess(`Delivery booked successfully! Charge: ₹${fee}`);
    setCustomerName(''); setCustomerMobile(''); setDeliveryAddress('');
    setParcelDesc(''); setNotes(''); setDistanceKm('');
    setDeliveryLocation(null);
    setBookingLoading(false);
    await loadData();
    setActiveTab('dashboard');
  }


  const active = deliveries.filter(d => ['pending','assigned','picked_up','arriving'].includes(d.status));
  const completed = deliveries.filter(d => d.status === 'completed');

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <PSpinner size="large" aria={{ 'aria-label': 'Loading' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <TopBar title="QuickDrop" />

      {activeTab === 'dashboard' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <div>
            <PHeading size="medium" tag="h2">Hello, {profile?.full_name} 👋</PHeading>
            <PText size="small" className="text-contrast-medium">{shop?.name ?? 'Set up your shop'}</PText>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active" value={active.length} accent="#006FFF"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="#006FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            />
            <StatCard label="Completed" value={completed.length} accent="#34C759"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            />
            <StatCard label="Wallet" value={`₹${(wallet?.balance ?? 0).toFixed(2)}`} accent="#FF9500"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#FF9500" strokeWidth="2"/><path d="M16 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="#FF9500"/></svg>}
            />
            <StatCard label="Total Deliveries" value={deliveries.length} accent="#AF52DE"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="#AF52DE" strokeWidth="2"/></svg>}
            />
          </div>

          {active.length > 0 && (
            <div>
              <PHeading size="small" tag="h3" className="mb-3">Active Deliveries</PHeading>
              <div className="space-y-3">
                {active.map(d => (
                  <DeliveryCard key={d.id} customerName={d.customer_name} address={d.delivery_address}
                    charge={d.charge} status={d.status} distance={d.distance_km}
                    onPress={() => setSelectedDelivery(d)}
                  />
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="text-center py-8">
              <PText className="text-contrast-medium">No active deliveries</PText>
              <PButton variant="secondary" className="mt-3" onClick={() => setActiveTab('book')}>
                Book a Delivery
              </PButton>
            </div>
          )}
        </div>
      )}

      {activeTab === 'book' && (
        <div className="p-fluid-md">
          <PHeading size="medium" tag="h2" className="mb-fluid-sm">Book Delivery</PHeading>

          {bookingError && (
            <div className="mb-fluid-sm">
              <PInlineNotification state="error" heading="Error" description={bookingError} dismissButton onDismiss={() => setBookingError('')} />
            </div>
          )}
          {bookingSuccess && (
            <div className="mb-fluid-sm">
              <PInlineNotification state="success" heading="Success" description={bookingSuccess} dismissButton onDismiss={() => setBookingSuccess('')} />
            </div>
          )}

          <form onSubmit={handleBookDelivery} className="space-y-fluid-sm">
            <div className="bg-surface rounded-[12px] p-3" style={{ border: '1px solid #E5E7EB' }}>
              <PText size="x-small" className="text-contrast-medium mb-1">Pickup Address (from shop)</PText>
              <PText size="small">{shop?.address || 'No address set in shop profile'}</PText>
            </div>

            <PInputText name="customer_name" label="Customer Name" value={customerName}
              onInput={(e) => setCustomerName((e.target as HTMLInputElement).value)} required />
            <PInputText name="customer_mobile" label="Customer Mobile" value={customerMobile}
              onInput={(e) => setCustomerMobile((e.target as HTMLInputElement).value)} required />
            <AddressSearch
              label="Delivery Address"
              value={deliveryAddress}
              placeholder="Search for the delivery location"
              required
              onInput={setDeliveryAddress}
              onPlaceSelected={(place) => {
                setDeliveryLocation(place);
                setDeliveryAddress(place.address);
              }}
            />
            {deliveryLocation && shop?.lat && shop?.lng && (
              <MapView
                center={{ lat: shop.lat, lng: shop.lng }}
                markers={[
                  { position: { lat: shop.lat, lng: shop.lng }, label: 'P', color: '#006FFF' },
                  { position: { lat: deliveryLocation.lat, lng: deliveryLocation.lng }, label: 'D', color: '#FF3B30' },
                ]}
                height="240px"
              />
            )}
            <div>
              <PInputText name="distance_km" label="Distance (KM)" value={distanceKm}
                onInput={(e) => setDistanceKm((e.target as HTMLInputElement).value)} required />
              {distanceLoading && (
                <PText size="x-small" className="text-contrast-medium mt-1">Calculating distance…</PText>
              )}
              {!shop?.lat && (
                <PText size="x-small" className="text-contrast-medium mt-1">Set your shop location in profile to auto-calculate distance.</PText>
              )}
            </div>
            <PInputText name="parcel_desc" label="Parcel Description" value={parcelDesc}
              onInput={(e) => setParcelDesc((e.target as HTMLInputElement).value)} required />
            <PInputText name="notes" label="Notes (Optional)" value={notes}
              onInput={(e) => setNotes((e.target as HTMLInputElement).value)} />

            {distanceKm && parseFloat(distanceKm) > 0 && (
              <div className="bg-[#EFF6FF] rounded-[12px] p-3 flex items-center justify-between">
                <PText size="small">Delivery Charge</PText>
                <PText size="large" weight="semi-bold" className="text-[#006FFF]">₹{charge}</PText>
              </div>
            )}

            <PButton type="submit" loading={bookingLoading}>Confirm & Book</PButton>
          </form>

          <PModal open={confirmOpen} onDismiss={() => setConfirmOpen(false)}>
            <PHeading slot="header" size="medium">Confirm Booking</PHeading>
            <div className="space-y-2">
              <PText>Delivery to: <strong>{customerName}</strong></PText>
              <PText>Address: {deliveryAddress}</PText>
              <PText>Distance: {distanceKm} km</PText>
              <PText>Charge: <strong style={{ color: '#006FFF' }}>₹{charge}</strong></PText>
              <PText size="small" className="text-contrast-medium">This amount will be deducted from your wallet.</PText>
            </div>
            <div slot="footer" className="flex gap-3">
              <PButton onClick={confirmBooking} loading={bookingLoading}>Confirm</PButton>
              <PButton variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</PButton>
            </div>
          </PModal>
        </div>
      )}

      {activeTab === 'wallet' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <PHeading size="medium" tag="h2">Wallet</PHeading>

          <div className="rounded-[16px] p-fluid-md text-white flex flex-col gap-2" style={{ background: 'linear-gradient(135deg,#006FFF 0%,#0044CC 100%)' }}>
            <PText size="x-small" style={{ color: 'rgba(255,255,255,.7)' }}>Available Balance</PText>
            <span className="text-3xl font-bold">₹{(wallet?.balance ?? 0).toFixed(2)}</span>
          </div>

          <PInlineNotification
            state="info"
            heading="Wallet recharge unavailable"
            description="Recharge will be available once a secure payment gateway is connected."
            dismissButton={false}
          />

          <div>
            <PText size="small" weight="semi-bold" className="mb-2">Transaction History</PText>
            <div className="space-y-2">
              {transactions.length === 0 && <PText size="small" className="text-contrast-medium">No transactions yet</PText>}
              {transactions.map(tx => (
                <div key={tx.id} className="bg-surface rounded-[12px] px-3 py-2.5 flex items-center justify-between" style={{ boxShadow: '0px 2px 6px rgba(0,0,0,.06)' }}>
                  <div>
                    <PText size="small">{tx.description}</PText>
                    <PText size="x-small" className="text-contrast-medium">{new Date(tx.created_at).toLocaleDateString()}</PText>
                  </div>
                  <span className={`font-semibold text-sm ${tx.type === 'recharge' || tx.type === 'credit' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                    {tx.type === 'recharge' || tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <PHeading size="medium" tag="h2">Delivery History</PHeading>
          <div className="space-y-3">
            {deliveries.length === 0 && <PText className="text-contrast-medium">No deliveries yet</PText>}
            {deliveries.map(d => (
              <DeliveryCard key={d.id} customerName={d.customer_name} address={d.delivery_address}
                charge={d.charge} status={d.status} distance={d.distance_km}
                onPress={() => setSelectedDelivery(d)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delivery Detail Modal */}
      <PModal open={!!selectedDelivery} onDismiss={() => setSelectedDelivery(null)}>
        <PHeading slot="header" size="medium">Delivery Details</PHeading>
        {selectedDelivery && (
          <div className="space-y-2">
            <StatusBadge status={selectedDelivery.status} />
            <PText><strong>Customer:</strong> {selectedDelivery.customer_name}</PText>
            <PText><strong>Mobile:</strong> {selectedDelivery.customer_mobile}</PText>
            <PText><strong>Pickup:</strong> {selectedDelivery.pickup_address}</PText>
            <PText><strong>Drop:</strong> {selectedDelivery.delivery_address}</PText>
            <PText><strong>Parcel:</strong> {selectedDelivery.parcel_description}</PText>
            {selectedDelivery.notes && <PText><strong>Notes:</strong> {selectedDelivery.notes}</PText>}
            <PText><strong>Distance:</strong> {selectedDelivery.distance_km} km</PText>
            <PText><strong>Charge:</strong> ₹{selectedDelivery.charge}</PText>
            <PText><strong>Booked:</strong> {new Date(selectedDelivery.created_at).toLocaleString()}</PText>
            {selectedDelivery.delivery_lat && selectedDelivery.delivery_lng && (
              <MapView
                center={{ lat: selectedDelivery.delivery_lat, lng: selectedDelivery.delivery_lng }}
                markers={[{ position: { lat: selectedDelivery.delivery_lat, lng: selectedDelivery.delivery_lng }, label: 'D', color: '#FF3B30' }]}
                height="200px"
              />
            )}
          </div>
        )}
        <div slot="footer">
          <PButton variant="secondary" onClick={() => setSelectedDelivery(null)}>Close</PButton>
        </div>
      </PModal>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} items={NAV_ITEMS} />
    </div>
  );
}
