import { createClient } from '@supabase/supabase-js';

// Keep the original README variable names working while also supporting the
// conventional VITE_SUPABASE_* names used by the market pages.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(configuredUrl && configuredAnonKey);
const supabaseUrl = configuredUrl || 'https://preview-placeholder.supabase.co';
const supabaseAnonKey = configuredAnonKey || 'preview-anon-key';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// 타입 정의
export interface Item {
  id: number;
  code: string;
  name: string;
  image: string;
  current_value: number;
  status: 'approved' | 'pending';
  votes: number;
  created_at: string;
  last_modified?: string;
  unit_type: 'piece' | 'set' | 'stack';
}

export interface Proposal {
  id: number;
  item_id?: number;
  item_code: string;
  item_name: string;
  item_image: string;
  proposed_value: number;
  current_value?: number;
  current_votes: number;
  negative_votes: number;
  required_votes: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  type: string;
  unit_type?: 'piece' | 'set' | 'stack';
}

export interface ValueHistory {
  id: number;
  item_id: number;
  value: number;
  previous_value?: number;
  changed_at: string;
  reason: string;
  votes: number;
}

export interface Banner {
  id: number;
  title: string;
  image: string;
  link?: string;
  active: boolean;
  created_at: string;
}

export interface Vote {
  id: number;
  proposal_id: number;
  fingerprint: string;
  voted_at: string;
  vote_type: 'up' | 'down';
}
