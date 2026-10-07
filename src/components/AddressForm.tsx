import {
  PInputText,
  PText,
  PButtonPure,
} from '@porsche-design-system/components-react';
import type { StructuredAddress } from '../lib/maps';

interface Props {
  label: string;
  address: StructuredAddress;
  onChange: (a: StructuredAddress) => void;
  onOpenMap?: () => void;
  hasPin?: boolean;
}

export default function AddressForm({ label, address, onChange, onOpenMap, hasPin }: Props) {
  function update<K extends keyof StructuredAddress>(key: K, val: string) {
    onChange({ ...address, [key]: val });
  }

  return (
    <div className="bg-surface rounded-[12px] p-3 space-y-3" style={{ border: '1px solid var(--pds-color-contrast-low-light, #D8D8DB)' }}>
      <div className="flex items-center justify-between">
        <PText size="small" weight="semi-bold">{label}</PText>
        {onOpenMap && (
          <PButtonPure icon="geo-localization" size="small" onClick={onOpenMap}>
            {hasPin ? 'Adjust on map' : 'Select on map'}
          </PButtonPure>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PInputText name={`${label}_house`} label="House / Flat No." value={address.house_flat}
          onInput={(e) => update('house_flat', (e.target as HTMLInputElement).value)} />
        <PInputText name={`${label}_building`} label="Building / Apartment" value={address.building}
          onInput={(e) => update('building', (e.target as HTMLInputElement).value)} />
      </div>
      <PInputText name={`${label}_road`} label="Road / Street" value={address.road}
        onInput={(e) => update('road', (e.target as HTMLInputElement).value)} />
      <div className="grid grid-cols-2 gap-2">
        <PInputText name={`${label}_area`} label="Area / Locality" value={address.area}
          onInput={(e) => update('area', (e.target as HTMLInputElement).value)} />
        <PInputText name={`${label}_landmark`} label="Landmark (optional)" value={address.landmark}
          onInput={(e) => update('landmark', (e.target as HTMLInputElement).value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PInputText name={`${label}_city`} label="City / Town" value={address.city}
          onInput={(e) => update('city', (e.target as HTMLInputElement).value)} />
        <PInputText name={`${label}_district`} label="District" value={address.district}
          onInput={(e) => update('district', (e.target as HTMLInputElement).value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PInputText name={`${label}_state`} label="State" value={address.state}
          onInput={(e) => update('state', (e.target as HTMLInputElement).value)} />
        <PInputText name={`${label}_pincode`} label="PIN Code" value={address.pincode}
          onInput={(e) => update('pincode', (e.target as HTMLInputElement).value)} />
      </div>
    </div>
  );
}
