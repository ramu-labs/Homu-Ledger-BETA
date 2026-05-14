// AUTO-GENERATED — do not edit by hand.
// Regenerated via Supabase MCP after migration 0024_household_ai_language.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_usage_logs: {
        Row: {
          cache_status: string
          created_at: string
          estimated_cost_usd: number
          feature: string
          household_id: string | null
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          preview: string | null
          provider: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          cache_status?: string
          created_at?: string
          estimated_cost_usd?: number
          feature: string
          household_id?: string | null
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          preview?: string | null
          provider: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          cache_status?: string
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          household_id?: string | null
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          preview?: string | null
          provider?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          household_id: string
          id: string
          is_default: boolean
          name: string
          symbol: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          color: string
          created_at?: string
          household_id: string
          id?: string
          is_default?: boolean
          name: string
          symbol: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          id?: string
          is_default?: boolean
          name?: string
          symbol?: string
          type?: Database["public"]["Enums"]["transaction_type"]
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
      category_hints: {
        Row: {
          category_id: string
          hits: number
          household_id: string
          keyword: string
          source: string
          updated_at: string
        }
        Insert: {
          category_id: string
          hits?: number
          household_id: string
          keyword: string
          source?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          hits?: number
          household_id?: string
          keyword?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_hints_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_hints_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          attachments: string[]
          body: string
          category: string
          created_at: string
          created_by: string | null
          household_id: string | null
          id: string
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: string
          subject: string
        }
        Insert: {
          attachments?: string[]
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          household_id?: string | null
          id?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject: string
        }
        Update: {
          attachments?: string[]
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          household_id?: string | null
          id?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          ai_language: string
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
          ai_language?: string
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
          ai_language?: string
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
          label: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          tier: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          tier: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
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
            foreignKeyName: "transactions_recurring_item_id_fkey"
            columns: ["recurring_item_id"]
            isOneToOne: false
            referencedRelation: "recurring_items"
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
      api_usage_recent_window: {
        Args: never
        Returns: {
          rpd_now: number
          rpm_errors: number
          rpm_now: number
          tpm_now: number
        }[]
      }
      can_access_feedback_attachment: {
        Args: { p_path: string }
        Returns: boolean
      }
      can_access_transaction_photo: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      clear_category_hints: { Args: never; Returns: number }
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
        Args: { p_label?: string; p_tier: string }
        Returns: {
          code: string
          created_at: string
          id: string
          label: string
          tier: string
        }[]
      }
      generate_promo_code_string: { Args: never; Returns: string }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_ledger_totals: {
        Args: never
        Returns: {
          balance: number
          expenses: number
          income: number
        }[]
      }
      is_developer_caller: { Args: never; Returns: boolean }
      is_promo_code_valid: { Args: { p_code: string }; Returns: boolean }
      join_household_by_invite_code: {
        Args: { p_code: string }
        Returns: string
      }
      log_api_usage: {
        Args: {
          p_cache_status: string
          p_estimated_cost: number
          p_feature: string
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_preview?: string
          p_provider: string
        }
        Returns: undefined
      }
      lookup_user_for_invite: {
        Args: { p_query: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      materialize_due_recurring_items: { Args: never; Returns: number }
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
      save_app_setting: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      seed_default_category_hints: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      switch_household: { Args: { p_household_id: string }; Returns: undefined }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      recurring_frequency: ["weekly", "monthly", "yearly"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
