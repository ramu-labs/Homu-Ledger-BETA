// AUTO-GENERATED — do not edit by hand.
// Regenerate with the Supabase CLI when the schema changes:
//   npx supabase gen types typescript --project-id qunbbkptumtzgzzwnszy --schema public > lib/supabase/database.types.ts
//
// These types are wired into createClient<Database>() in lib/supabase/server.ts
// and lib/supabase/client.ts so that `.from('table').select('column')` becomes
// a TypeScript error if the column doesn't exist. (That's how the M&D
// "members not showing" bug slipped past code review — the page selected
// `created_at` from `household_members`, which actually has `joined_at`.
// Untyped Supabase queries silently return zero rows in that case.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          household_id: string
          id: string
          is_default: boolean
          name: string
          symbol: string
          type: "income" | "expense"
        }
        Insert: {
          color: string
          created_at?: string
          household_id: string
          id?: string
          is_default?: boolean
          name: string
          symbol: string
          type?: "income" | "expense"
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          id?: string
          is_default?: boolean
          name?: string
          symbol?: string
          type?: "income" | "expense"
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          created_at: string
          household_id: string
          id: string
          invited_by: string
          invited_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          profile_id: string
          role: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          currency: string
          id: string
          invite_code: string
          name: string
          opening_balance: number
          owner_id: string | null
          symbol: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          invite_code: string
          name: string
          opening_balance?: number
          owner_id?: string | null
          symbol?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          invite_code?: string
          name?: string
          opening_balance?: number
          owner_id?: string | null
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          household_id: string | null
          icon_style: string
          id: string
          initials: string
          is_developer: boolean
          language: string
          name: string
          subscription_expires_at: string | null
          subscription_tier: string | null
          username: string | null
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          household_id?: string | null
          icon_style?: string
          id: string
          initials: string
          is_developer?: boolean
          language?: string
          name: string
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          username?: string | null
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          household_id?: string | null
          icon_style?: string
          id?: string
          initials?: string
          is_developer?: boolean
          language?: string
          name?: string
          subscription_expires_at?: string | null
          subscription_tier?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          tier: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          tier: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_items: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          household_id: string
          id: string
          name: string
          next_due_date: string | null
          repeat_until: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          household_id: string
          id?: string
          name: string
          next_due_date?: string | null
          repeat_until?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          household_id?: string
          id?: string
          name?: string
          next_due_date?: string | null
          repeat_until?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_items_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          date: string
          household_id: string
          id: string
          name: string
          note: string | null
          photo_url: string | null
          recurring_item_id: string | null
          transfer_pair_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          household_id: string
          id?: string
          name: string
          note?: string | null
          photo_url?: string | null
          recurring_item_id?: string | null
          transfer_pair_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          household_id?: string
          id?: string
          name?: string
          note?: string | null
          photo_url?: string | null
          recurring_item_id?: string | null
          transfer_pair_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          color: string
          created_at: string
          household_id: string
          id: string
          initial_balance: number
          is_default: boolean
          name: string
          symbol: string
        }
        Insert: {
          color: string
          created_at?: string
          household_id: string
          id?: string
          initial_balance?: number
          is_default?: boolean
          name: string
          symbol: string
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          id?: string
          initial_balance?: number
          is_default?: boolean
          name?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      can_access_transaction_photo: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      create_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_from_wallet: string
          p_name: string
          p_to_wallet: string
        }
        Returns: {
          dest_id: string
          pair_id: string
          source_id: string
        }[]
      }
      current_household_id: { Args: never; Returns: string }
      delete_promo_code: { Args: { p_id: string }; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      generate_promo_code: {
        Args: { p_tier: string }
        Returns: {
          code: string
          created_at: string
          id: string
          tier: string
        }[]
      }
      generate_promo_code_string: { Args: never; Returns: string }
      get_ledger_totals: {
        Args: never
        Returns: {
          balance: number
          expenses: number
          income: number
        }[]
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      is_promo_code_valid: { Args: { p_code: string }; Returns: boolean }
      join_household_by_invite_code: {
        Args: { p_code: string }
        Returns: string
      }
      lookup_household_by_invite_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      lookup_user_for_invite: {
        Args: { p_query: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      move_transaction: {
        Args: { p_target_household_id: string; p_transaction_id: string }
        Returns: undefined
      }
      redeem_promo_code: {
        Args: { p_code: string }
        Returns: {
          expires_at: string
          tier: string
        }[]
      }
      switch_household: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      materialize_due_recurring_items: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      recurring_frequency: "weekly" | "monthly" | "yearly"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
