import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'shop_owner' | 'rider' | 'admin';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  mobile: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  is_active: boolean;
  created_at: string;
}

export interface Rider {
  id: string;
  is_online: boolean;
  is_verified: boolean;
  bank_account?: string;
  bank_ifsc?: string;
  aadhaar_number?: string;
  current_lat?: number;
  current_lng?: number;
  created_at: string;
}

export type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'arriving' | 'completed' | 'cancelled' | 'rejected';

export interface Delivery {
  id: string;
  shop_id: string;
  rider_id?: string;
  rejected_by_riders?: string[];
  customer_name: string;
  customer_mobile: string;
  pickup_address: string;
  delivery_address: string;
  parcel_description: string;
  notes?: string;
  distance_km: number;
  charge: number;
  status: DeliveryStatus;
  otp?: string;
  otp_verified: boolean;
  delivery_lat?: number;
  delivery_lng?: number;
  assigned_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  profile_id: string;
  balance: number;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: 'credit' | 'debit' | 'recharge' | 'withdrawal';
  amount: number;
  description: string;
  delivery_id?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export type DocType = 'aadhaar' | 'pan' | 'driving_licence';

export interface RiderDocument {
  id: string;
  rider_id: string;
  doc_type: DocType;
  file_path: string;
  file_name: string;
  mime_type: string;
  created_at: string;
}

export function calcDeliveryCharge(km: number): number {
  if (km <= 0) return 29;
  if (km <= 4) return 29;
  return 29 + Math.ceil(km - 4) * 5;
}
