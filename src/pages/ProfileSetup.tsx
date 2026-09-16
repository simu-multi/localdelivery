import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  PHeading, PText, PButton, PInputText,
  PSelect, PSelectOption, PInlineNotification,
} from '@porsche-design-system/components-react';
import type { Role } from '../lib/supabase';
import AddressSearch from '../components/AddressSearch';
import MapView from '../components/MapView';
import type { PlaceResult } from '../lib/maps';

export default function ProfileSetup() {
  const { user, refreshProfile } = useAuth();
  const googleName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '';
  const googleAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '';

  const [fullName, setFullName] = useState(() => googleName);
  const [mobile, setMobile] = useState(() => user?.user_metadata?.mobile ?? '');
  const [role, setRole] = useState<Role>(() => user?.user_metadata?.role === 'rider' ? 'rider' : 'shop_owner');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopLocation, setShopLocation] = useState<PlaceResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) return;
    setError('');
    setLoading(true);

    const { error: profileErr } = await supabase.rpc('create_user_profile', {
      p_role: role,
      p_full_name: fullName,
      p_mobile: mobile,
    });

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    // Save Google avatar if available
    if (googleAvatar) {
      await supabase.from('profiles').update({ avatar_url: googleAvatar }).eq('id', user.id);
    }

    if (role === 'shop_owner') {
      await supabase.from('shops').insert({
        owner_id: user.id,
        name: shopName || fullName + "'s Shop",
        address: shopLocation?.address ?? shopAddress,
        lat: shopLocation?.lat ?? null,
        lng: shopLocation?.lng ?? null,
      });
    } else if (role === 'rider') {
      await supabase.from('riders').insert({ id: user.id });
    }

    await refreshProfile();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-fluid-md">
      <div className="w-full max-w-md bg-surface rounded-[16px] p-fluid-lg" style={{ boxShadow: '0px 8px 40px rgba(0,0,0,.12)' }}>
        <PHeading size="medium" tag="h1" className="mb-2">Complete Your Profile</PHeading>
        <PText size="small" className="text-contrast-medium mb-fluid-md">Tell us who you are to get started</PText>

        {user?.email && (
          <div className="mb-4 p-3 rounded-[12px] bg-[#EFF6FF] border border-[#BFDBFE] flex items-center gap-3">
            {googleAvatar ? (
              <img src={googleAvatar} alt="Profile" className="w-10 h-10 rounded-full border border-[#BFDBFE] object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#006FFF] text-white font-bold flex items-center justify-center">
                {(fullName || user.email)[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <PText size="small" weight="semi-bold" className="truncate">{user.email}</PText>
              <PText size="x-small" className="text-contrast-medium">Connected Account</PText>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-fluid-sm">
            <PInlineNotification state="error" heading="Error" description={error} dismissButton={false} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-fluid-sm">
          <PInputText name="full_name" label="Full Name" value={fullName}
            onInput={(e) => setFullName((e.target as HTMLInputElement).value)} />
          <PInputText name="mobile" label="Mobile Number" value={mobile}
            onInput={(e) => setMobile((e.target as HTMLInputElement).value)} />
          <PSelect name="role" label="I am a" value={role} onUpdate={(e) => setRole(e.detail.value as Role)}>
            <PSelectOption value="shop_owner">Shop Owner</PSelectOption>
            <PSelectOption value="rider">Delivery Rider</PSelectOption>
          </PSelect>

          {role === 'shop_owner' && (
            <>
              <PInputText name="shop_name" label="Shop Name" value={shopName}
                onInput={(e) => setShopName((e.target as HTMLInputElement).value)} />
              <AddressSearch
                label="Shop / Pickup Address"
                value={shopAddress}
                placeholder="Search for your shop location"
                onInput={setShopAddress}
                onPlaceSelected={(place) => {
                  setShopLocation(place);
                  setShopAddress(place.address);
                }}
              />
              {shopLocation && (
                <MapView center={{ lat: shopLocation.lat, lng: shopLocation.lng }} height="200px" />
              )}
            </>
          )}

          <PButton type="submit" loading={loading}>Get Started</PButton>
        </form>
      </div>
    </div>
  );
}
