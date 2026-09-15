import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Delivery, Wallet, WalletTransaction, Rider, Shop, RiderDocument, DocType } from '../lib/supabase';
import {
  PHeading, PText, PButton, PInputText,
  PSpinner, PInlineNotification, PSwitch,
} from '@porsche-design-system/components-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { StatCard } from '../components/Cards';
import MapView from '../components/MapView';
import type { LatLng } from '../lib/maps';

const NAV_ITEMS = [
  { icon: 'home', label: 'Dashboard', tab: 'dashboard' },
  { icon: 'arrows', label: 'Deliveries', tab: 'deliveries' },
  { icon: 'card', label: 'Earnings', tab: 'earnings' },
  { icon: 'user', label: 'Profile', tab: 'profile' },
];

const PLATFORM_COMMISSION = 8;

const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: 'aadhaar', label: 'Aadhaar Card' },
  { key: 'pan', label: 'PAN Card' },
  { key: 'driving_licence', label: 'Driving Licence' },
];

interface DeliveryWithShop extends Delivery {
  shops?: Shop[];
}

export default function RiderDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [rider, setRider] = useState<Rider | null>(null);
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryWithShop | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [documents, setDocuments] = useState<RiderDocument[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [riderRes, walletRes, availRes, myRes] = await Promise.all([
      supabase.from('riders').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('wallets').select('*').eq('profile_id', user.id).maybeSingle(),
      supabase.from('deliveries').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('deliveries').select('*, shops(*)').eq('rider_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);

    setRider(riderRes.data ?? null);
    setWallet(walletRes.data ?? null);
    setAvailableDeliveries((availRes.data ?? []).filter((delivery) => !(delivery.rejected_by_riders ?? []).includes(user.id)));

    const myData: DeliveryWithShop[] = myRes.data ?? [];
    setMyDeliveries(myData);
    setActiveDelivery(myData.find(d => ['assigned','picked_up','arriving'].includes(d.status)) ?? null);

    if (walletRes.data) {
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletRes.data.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setTransactions(txData ?? []);
    }

    const { data: docs } = await supabase.from('rider_documents').select('*').eq('rider_id', user.id).order('created_at', { ascending: false });
    setDocuments(docs ?? []);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleOnline() {
    if (!rider || !user) return;
    const newStatus = !rider.is_online;
    await supabase.from('riders').update({ is_online: newStatus }).eq('id', user.id);
    setRider({ ...rider, is_online: newStatus });
  }

  async function acceptDelivery(delivery: Delivery) {
    if (!user) return;
    setActionError('');
    setActionLoading(true);
    const { error } = await supabase.from('deliveries').update({
      rider_id: user.id,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    }).eq('id', delivery.id).eq('status', 'pending');

    if (error) {
      setActionError(error.message);
      setActionLoading(false);
      return;
    }
    await loadData();
    setActiveTab('deliveries');
    setActionLoading(false);
  }

  async function rejectDelivery(delivery: Delivery) {
    if (!user) return;
    setActionError('');
    setActionLoading(true);
    const { error } = await supabase.from('deliveries').update({
      rejected_by_riders: [...(delivery.rejected_by_riders ?? []), user.id],
    }).eq('id', delivery.id).eq('status', 'pending');

    if (error) {
      setActionError(error.message);
    } else {
      await loadData();
    }
    setActionLoading(false);
  }

  async function updateDeliveryStatus(delivery: Delivery, status: string) {
    setActionLoading(true);
    const updates: Record<string, unknown> = { status };
    if (status === 'picked_up') updates.picked_up_at = new Date().toISOString();
    if (status === 'arriving') {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      updates.otp = otp;
    }
    await supabase.from('deliveries').update(updates).eq('id', delivery.id);
    await loadData();
    setActionLoading(false);
  }

  async function verifyOtp(delivery: Delivery) {
    if (!wallet || !user) return;
    setOtpError('');
    setActionLoading(true);

    const { data: fresh } = await supabase.from('deliveries').select('otp').eq('id', delivery.id).maybeSingle();
    if (!fresh || fresh.otp !== otpInput) {
      setOtpError('Incorrect OTP. Please try again.');
      setActionLoading(false);
      return;
    }

    const earnings = delivery.charge - PLATFORM_COMMISSION;
    const { error: deliveryError } = await supabase.from('deliveries').update({
      status: 'completed',
      otp_verified: true,
      completed_at: new Date().toISOString(),
    }).eq('id', delivery.id).eq('rider_id', user.id).eq('status', 'arriving');

    if (deliveryError) {
      setOtpError('Could not complete delivery. Please try again.');
      setActionLoading(false);
      return;
    }

    const { error: creditError } = await supabase.rpc('credit_wallet', {
      p_wallet_id: wallet.id,
      p_amount: earnings,
      p_description: `Delivery earnings (₹${delivery.charge} - ₹${PLATFORM_COMMISSION} commission)`,
      p_delivery_id: delivery.id,
    });
    if (creditError) {
      setOtpError('Delivery completed, but earnings could not be recorded. Please contact support.');
      setActionLoading(false);
      return;
    }

    setOtpInput('');
    setActiveDelivery(null);
    await loadData();
    setActionLoading(false);
  }

  async function uploadDocument(e: React.ChangeEvent<HTMLInputElement>, docType: DocType) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setDocError('');
    setDocUploading(true);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setDocError('Please upload an image (JPG, PNG, WebP) or PDF file.');
      setDocUploading(false);
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDocError('File is too large. Maximum size is 5 MB.');
      setDocUploading(false);
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const filePath = `${user.id}/${docType}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('rider-documents')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      setDocError('Could not upload the file. Please try again.');
      setDocUploading(false);
      e.target.value = '';
      return;
    }

    const { error: dbErr } = await supabase.from('rider_documents').insert({
      rider_id: user.id,
      doc_type: docType,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
    });

    if (dbErr) {
      await supabase.storage.from('rider-documents').remove([filePath]);
      setDocError('Could not save the document record. Please try again.');
    }

    setDocUploading(false);
    e.target.value = '';
    await loadData();
  }

  async function viewDocument(doc: RiderDocument) {
    const { data, error } = await supabase.storage
      .from('rider-documents')
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function deleteDocument(doc: RiderDocument) {
    await supabase.storage.from('rider-documents').remove([doc.file_path]);
    await supabase.from('rider_documents').delete().eq('id', doc.id);
    await loadData();
  }

  const todayEarnings = transactions
    .filter(t => t.type === 'credit' && new Date(t.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Build map markers for active delivery
  const pickupCoords: LatLng | null = activeDelivery?.shops?.[0]?.lat && activeDelivery?.shops?.[0]?.lng
    ? { lat: activeDelivery.shops[0].lat, lng: activeDelivery.shops[0].lng }
    : null;
  const deliveryCoords: LatLng | null = activeDelivery?.delivery_lat && activeDelivery?.delivery_lng
    ? { lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng }
    : null;
  const mapMarkers: Array<{ position: LatLng; label?: string; color?: string }> = [];
  if (pickupCoords) mapMarkers.push({ position: pickupCoords, label: 'P', color: '#006FFF' });
  if (deliveryCoords) mapMarkers.push({ position: deliveryCoords, label: 'D', color: '#FF3B30' });
  const mapCenter: LatLng = deliveryCoords ?? pickupCoords ?? { lat: 0, lng: 0 };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <PSpinner size="large" aria={{ 'aria-label': 'Loading' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <TopBar title="QuickDrop Rider" />

      {activeTab === 'dashboard' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <div className="flex items-center justify-between">
            <div>
              <PHeading size="medium" tag="h2">Hello, {profile?.full_name}</PHeading>
              <PText size="small" className="text-contrast-medium">Rider Dashboard</PText>
            </div>
            <PSwitch checked={rider?.is_online ?? false} onUpdate={toggleOnline}>
              {rider?.is_online ? 'Online' : 'Offline'}
            </PSwitch>
          </div>

          {!rider?.is_online && (
            <PInlineNotification state="warning" heading="You are offline" description="Go online to receive delivery requests." dismissButton={false} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Today's Earnings" value={`₹${todayEarnings.toFixed(2)}`} accent="#34C759" />
            <StatCard label="Wallet Balance" value={`₹${(wallet?.balance ?? 0).toFixed(2)}`} accent="#006FFF" />
            <StatCard label="Completed" value={myDeliveries.filter(d => d.status === 'completed').length} accent="#AF52DE" />
            <StatCard label="Available" value={activeDelivery ? 0 : availableDeliveries.length} accent="#FF9500" />
          </div>

          {activeDelivery && (
            <div className="rounded-[16px] p-fluid-sm" style={{ background: 'linear-gradient(135deg,#006FFF,#0044CC)', boxShadow: '0px 4px 16px rgba(0,111,255,.3)' }}>
              <PText size="x-small" style={{ color: 'rgba(255,255,255,.7)' }}>Active Delivery</PText>
              <PText weight="semi-bold" style={{ color: '#fff' }}>{activeDelivery.customer_name}</PText>
              <PText size="small" style={{ color: 'rgba(255,255,255,.8)' }}>{activeDelivery.delivery_address}</PText>
              <PButton variant="secondary" className="mt-3" onClick={() => setActiveTab('deliveries')}>Manage →</PButton>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <PHeading size="medium" tag="h2">Deliveries</PHeading>

          {activeDelivery && (
            <div>
              <PText size="small" weight="semi-bold" className="mb-2">Active Delivery</PText>
              <div className="bg-surface rounded-[16px] p-fluid-sm space-y-3" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
                <div>
                  <PText weight="semi-bold">{activeDelivery.customer_name}</PText>
                  <PText size="small" className="text-contrast-medium">📞 {activeDelivery.customer_mobile}</PText>
                  <PText size="small">📦 {activeDelivery.parcel_description}</PText>
                </div>

                {/* Map showing pickup and delivery */}
                {mapMarkers.length > 0 && (
                  <MapView center={mapCenter} markers={mapMarkers} height="220px" />
                )}

                {/* Pickup location card */}
                <div className="rounded-[12px] p-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#006FFF' }}>P</span>
                    <PText size="small" weight="semi-bold">Pickup</PText>
                  </div>
                  <PText size="small" className="text-contrast-medium">{activeDelivery.pickup_address}</PText>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeDelivery.pickup_address)}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    <PButton variant="secondary" icon="map" className="mt-2" style={{ width: '100%' }}>
                      Navigate to Pickup
                    </PButton>
                  </a>
                </div>

                {/* Delivery location card */}
                <div className="rounded-[12px] p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#FF3B30' }}>D</span>
                    <PText size="small" weight="semi-bold">Drop-off</PText>
                  </div>
                  <PText size="small" className="text-contrast-medium">{activeDelivery.delivery_address}</PText>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeDelivery.delivery_address)}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    <PButton variant="tertiary" icon="map" className="mt-2" style={{ width: '100%' }}>
                      Navigate to Delivery
                    </PButton>
                  </a>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeDelivery.status === 'assigned' ? 'bg-[#006FFF]' : 'bg-[#D4EDDA]'}`} />
                  <span className={`w-2.5 h-2.5 rounded-full ${activeDelivery.status === 'picked_up' ? 'bg-[#006FFF]' : ['picked_up','arriving'].includes(activeDelivery.status) ? 'bg-[#D4EDDA]' : 'bg-contrast-low'}`} />
                  <span className={`w-2.5 h-2.5 rounded-full ${activeDelivery.status === 'arriving' ? 'bg-[#006FFF]' : 'bg-contrast-low'}`} />
                </div>

                {/* Action buttons based on status */}
                {activeDelivery.status === 'assigned' && (
                  <PButton onClick={() => updateDeliveryStatus(activeDelivery, 'picked_up')} loading={actionLoading} style={{ width: '100%' }}>
                    Mark Picked Up
                  </PButton>
                )}
                {activeDelivery.status === 'picked_up' && (
                  <PButton onClick={() => updateDeliveryStatus(activeDelivery, 'arriving')} loading={actionLoading} style={{ width: '100%' }}>
                    Arrived at Customer
                  </PButton>
                )}
                {activeDelivery.status === 'arriving' && (
                  <div className="space-y-2">
                    <PInlineNotification state="info" heading="OTP sent to customer" description="Ask the customer for the OTP to complete delivery." dismissButton={false} />
                    {otpError && <PInlineNotification state="error" heading="Wrong OTP" description={otpError} dismissButton onDismiss={() => setOtpError('')} />}
                    <PInputText name="otp" label="Enter OTP" value={otpInput}
                      onInput={(e) => setOtpInput((e.target as HTMLInputElement).value)}
                      maxLength={6} description="6-digit OTP from customer"
                    />
                    <PButton onClick={() => verifyOtp(activeDelivery)} loading={actionLoading} disabled={otpInput.length !== 6} style={{ width: '100%' }}>
                      Verify OTP & Complete
                    </PButton>
                  </div>
                )}

                <a href={`tel:${activeDelivery.customer_mobile}`} className="block">
                  <PButton variant="secondary" icon="phone" style={{ width: '100%' }}>Call Customer</PButton>
                </a>
              </div>
            </div>
          )}

          {/* Available requests - only shown when no active delivery (one ride at a time) */}
          {!activeDelivery && rider?.is_online && availableDeliveries.length > 0 && (
            <div>
              {actionError && (
                <div className="mb-2">
                  <PInlineNotification state="error" heading="Could not accept" description={actionError} dismissButton onDismiss={() => setActionError('')} />
                </div>
              )}
              <PText size="small" weight="semi-bold" className="mb-2">Available Requests ({availableDeliveries.length})</PText>
              <div className="space-y-3">
                {availableDeliveries.map(d => (
                  <div key={d.id} className="bg-surface rounded-[16px] p-fluid-sm" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
                    <div className="mb-2">
                      <PText weight="semi-bold">{d.customer_name}</PText>
                      <PText size="small" className="text-contrast-medium">From: {d.pickup_address}</PText>
                      <PText size="small" className="text-contrast-medium">To: {d.delivery_address}</PText>
                      <div className="flex gap-4 mt-1">
                        <PText size="small">📏 {d.distance_km} km</PText>
                        <PText size="small" weight="semi-bold" style={{ color: '#006FFF' }}>₹{d.charge - PLATFORM_COMMISSION} earnings</PText>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PButton onClick={() => acceptDelivery(d)} loading={actionLoading}>Accept</PButton>
                      <PButton variant="secondary" onClick={() => rejectDelivery(d)} loading={actionLoading}>Reject</PButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* One ride at a time notice */}
          {activeDelivery && rider?.is_online && availableDeliveries.length > 0 && (
            <PInlineNotification
              state="info"
              heading="Complete your active delivery first"
              description="You can accept new requests once your current delivery is completed."
              dismissButton={false}
            />
          )}

          {!activeDelivery && !availableDeliveries.length && (
            <PInlineNotification
              state={rider?.is_online ? 'neutral' : 'warning'}
              heading={rider?.is_online ? 'No deliveries available' : 'You are offline'}
              description={rider?.is_online ? 'Check back soon for new requests.' : 'Toggle online status to receive deliveries.'}
              dismissButton={false}
            />
          )}
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <PHeading size="medium" tag="h2">Earnings</PHeading>

          <div className="rounded-[16px] p-fluid-md text-white" style={{ background: 'linear-gradient(135deg,#34C759 0%,#248A3D 100%)' }}>
            <PText size="x-small" style={{ color: 'rgba(255,255,255,.7)' }}>Wallet Balance</PText>
            <span className="text-3xl font-bold block mt-1">₹{(wallet?.balance ?? 0).toFixed(2)}</span>
          </div>

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
                  <span className={`font-semibold text-sm ${tx.type === 'credit' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                    {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="p-fluid-md space-y-fluid-sm">
          <PHeading size="medium" tag="h2">My Profile</PHeading>

          <div className="bg-surface rounded-[16px] p-fluid-sm space-y-2" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
            <div className="flex items-center gap-3 pb-3 border-b border-contrast-low">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: '#006FFF' }}>
                {(profile?.full_name ?? 'R')[0].toUpperCase()}
              </div>
              <div>
                <PText weight="semi-bold">{profile?.full_name}</PText>
                <PText size="small" className="text-contrast-medium">{profile?.mobile}</PText>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <PText size="small">KYC Status</PText>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rider?.is_verified ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#FFF3CD] text-[#856404]'}`}>
                {rider?.is_verified ? 'Verified' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <PText size="small">Bank Account</PText>
              <PText size="small" className="text-contrast-medium">{rider?.bank_account ? '****' + rider.bank_account.slice(-4) : 'Not added'}</PText>
            </div>
          </div>

          {/* Identity Documents section */}
          <div className="bg-surface rounded-[16px] p-fluid-sm space-y-3" style={{ boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}>
            <PHeading size="small" tag="h3">Identity Documents</PHeading>
            <PText size="x-small" className="text-contrast-medium">Upload your documents for identity proof. This is for record purposes only — you can accept deliveries without waiting for approval.</PText>

            {docError && (
              <PInlineNotification state="error" heading="Upload failed" description={docError} dismissButton onDismiss={() => setDocError('')} />
            )}

            {DOC_TYPES.map(({ key, label }) => {
              const doc = documents.find(d => d.doc_type === key);
              return (
                <div key={key} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0 flex-1">
                    <PText size="small" weight="semi-bold">{label}</PText>
                    {doc ? (
                      <PText size="x-small" className="text-contrast-medium truncate">{doc.file_name}</PText>
                    ) : (
                      <PText size="x-small" className="text-contrast-medium">Not uploaded</PText>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {doc && (
                      <PButton variant="secondary" icon="view" onClick={() => viewDocument(doc)} />
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={docUploading}
                        onChange={(e) => uploadDocument(e, key)}
                      />
                      <PButton variant="secondary" icon="upload" loading={docUploading} disabled={docUploading}>
                        {doc ? 'Replace' : 'Upload'}
                      </PButton>
                    </label>
                    {doc && (
                      <PButton variant="tertiary" icon="delete" onClick={() => deleteDocument(doc)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} items={NAV_ITEMS} />
    </div>
  );
}
