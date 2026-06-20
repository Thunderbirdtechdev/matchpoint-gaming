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
      challenges: {
        Row: {
          created_at: string
          creator_id: string
          entry_amount: number
          game_slug: string
          id: string
          opponent_id: string | null
          platform: string
          rules: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          entry_amount?: number
          game_slug: string
          id?: string
          opponent_id?: string | null
          platform: string
          rules?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          entry_amount?: number
          game_slug?: string
          id?: string
          opponent_id?: string | null
          platform?: string
          rules?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      crypto_payout_addresses: {
        Row: {
          address: string
          created_at: string
          currency: Database["public"]["Enums"]["crypto_currency"]
          id: string
          label: string | null
          network: Database["public"]["Enums"]["crypto_network"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          currency: Database["public"]["Enums"]["crypto_currency"]
          id?: string
          label?: string | null
          network: Database["public"]["Enums"]["crypto_network"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["crypto_currency"]
          id?: string
          label?: string | null
          network?: Database["public"]["Enums"]["crypto_network"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_payouts: {
        Row: {
          amount_cents: number
          amount_crypto: number | null
          created_at: string
          currency: Database["public"]["Enums"]["crypto_currency"]
          error: string | null
          fee_cents: number
          id: string
          metadata: Json
          network: Database["public"]["Enums"]["crypto_network"]
          status: Database["public"]["Enums"]["crypto_payout_status"]
          to_address: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount_cents: number
          amount_crypto?: number | null
          created_at?: string
          currency: Database["public"]["Enums"]["crypto_currency"]
          error?: string | null
          fee_cents?: number
          id?: string
          metadata?: Json
          network: Database["public"]["Enums"]["crypto_network"]
          status?: Database["public"]["Enums"]["crypto_payout_status"]
          to_address: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount_cents?: number
          amount_crypto?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["crypto_currency"]
          error?: string | null
          fee_cents?: number
          id?: string
          metadata?: Json
          network?: Database["public"]["Enums"]["crypto_network"]
          status?: Database["public"]["Enums"]["crypto_payout_status"]
          to_address?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          challenge_id: string | null
          created_at: string
          evidence_url: string | null
          id: string
          opened_by: string
          reason: string
          resolution: string | null
          status: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          opened_by: string
          reason: string
          resolution?: string | null
          status?: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          opened_by?: string
          reason?: string
          resolution?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      escrow_holds: {
        Row: {
          amount_cents: number
          challenge_id: string | null
          created_at: string
          currency: string
          id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          tournament_id: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          challenge_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          challenge_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_holds_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_holds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_holds_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      manual_payout_requests: {
        Row: {
          admin_note: string | null
          amount_cents: number
          created_at: string
          fee_cents: number
          handle: string
          id: string
          method: Database["public"]["Enums"]["manual_payout_method"]
          net_cents: number
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["manual_payout_status"]
          updated_at: string
          user_id: string
          wallet_tx_id: string | null
        }
        Insert: {
          admin_note?: string | null
          amount_cents: number
          created_at?: string
          fee_cents?: number
          handle: string
          id?: string
          method: Database["public"]["Enums"]["manual_payout_method"]
          net_cents: number
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["manual_payout_status"]
          updated_at?: string
          user_id: string
          wallet_tx_id?: string | null
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          created_at?: string
          fee_cents?: number
          handle?: string
          id?: string
          method?: Database["public"]["Enums"]["manual_payout_method"]
          net_cents?: number
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["manual_payout_status"]
          updated_at?: string
          user_id?: string
          wallet_tx_id?: string | null
        }
        Relationships: []
      }
      paypal_payouts: {
        Row: {
          created_at: string
          currency: string
          error_message: string | null
          fee_cents: number
          fee_tx_id: string | null
          gross_amount_cents: number
          id: string
          metadata: Json
          net_amount_cents: number
          payout_batch_id: string | null
          payout_item_id: string | null
          recipient_email: string
          status: string
          updated_at: string
          user_id: string
          wallet_tx_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          error_message?: string | null
          fee_cents?: number
          fee_tx_id?: string | null
          gross_amount_cents: number
          id?: string
          metadata?: Json
          net_amount_cents: number
          payout_batch_id?: string | null
          payout_item_id?: string | null
          recipient_email: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_tx_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          error_message?: string | null
          fee_cents?: number
          fee_tx_id?: string | null
          gross_amount_cents?: number
          id?: string
          metadata?: Json
          net_amount_cents?: number
          payout_batch_id?: string | null
          payout_item_id?: string | null
          recipient_email?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_tx_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paypal_payouts_fee_tx_id_fkey"
            columns: ["fee_tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_payouts_wallet_tx_id_fkey"
            columns: ["wallet_tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          gross_cents: number | null
          id: string
          metadata: Json
          net_cents: number | null
          reference_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          gross_cents?: number | null
          id?: string
          metadata?: Json
          net_cents?: number | null
          reference_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          gross_cents?: number | null
          id?: string
          metadata?: Json
          net_cents?: number | null
          reference_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cashapp_tag: string | null
          created_at: string
          display_name: string | null
          favorite_game: string | null
          id: string
          paypal_email: string | null
          platform: string | null
          rank_tier: string
          region: string | null
          reputation: number
          updated_at: string
          username: string | null
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cashapp_tag?: string | null
          created_at?: string
          display_name?: string | null
          favorite_game?: string | null
          id: string
          paypal_email?: string | null
          platform?: string | null
          rank_tier?: string
          region?: string | null
          reputation?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cashapp_tag?: string | null
          created_at?: string
          display_name?: string | null
          favorite_game?: string | null
          id?: string
          paypal_email?: string | null
          platform?: string | null
          rank_tier?: string
          region?: string | null
          reputation?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      stripe_connect_accounts: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          details_submitted: boolean
          id: string
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          details_submitted?: boolean
          id?: string
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          details_submitted?: boolean
          id?: string
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          payload: Json | null
          processed_at: string
          type: string
        }
        Insert: {
          id: string
          payload?: Json | null
          processed_at?: string
          type: string
        }
        Update: {
          id?: string
          payload?: Json | null
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          created_at: string
          id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          description: string | null
          entry_fee: number
          format: string
          game_slug: string
          host_id: string
          id: string
          max_players: number
          platform: string
          prize_pool: number
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_fee?: number
          format?: string
          game_slug: string
          host_id: string
          id?: string
          max_players?: number
          platform: string
          prize_pool?: number
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_fee?: number
          format?: string
          game_slug?: string
          host_id?: string
          id?: string
          max_players?: number
          platform?: string
          prize_pool?: number
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          challenge_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json
          status: Database["public"]["Enums"]["wallet_tx_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          tournament_id: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          challenge_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          tournament_id?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          challenge_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_cents: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_wallet: {
        Args: { _user_id: string }
        Returns: {
          balance_cents: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      escrow_debit: {
        Args: {
          _amount_cents: number
          _challenge_id?: string
          _description?: string
          _tournament_id?: string
          _user_id: string
        }
        Returns: string
      }
      escrow_resolve: {
        Args: {
          _hold_id: string
          _new_status: Database["public"]["Enums"]["escrow_status"]
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      wallet_credit: {
        Args: {
          _amount_cents: number
          _challenge_id?: string
          _description: string
          _metadata?: Json
          _tournament_id?: string
          _type: Database["public"]["Enums"]["wallet_tx_type"]
          _user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      crypto_currency: "USDC" | "BTC"
      crypto_network: "base" | "bitcoin"
      crypto_payout_status:
        | "pending"
        | "sending"
        | "sent"
        | "failed"
        | "cancelled"
      escrow_status: "held" | "released" | "refunded" | "forfeited"
      manual_payout_method: "paypal" | "cashapp"
      manual_payout_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "canceled"
      wallet_tx_status: "pending" | "completed" | "failed" | "reversed"
      wallet_tx_type:
        | "deposit"
        | "withdrawal"
        | "entry_fee"
        | "prize_payout"
        | "platform_fee"
        | "refund"
        | "escrow_hold"
        | "escrow_release"
        | "adjustment"
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
      app_role: ["admin", "moderator", "user"],
      crypto_currency: ["USDC", "BTC"],
      crypto_network: ["base", "bitcoin"],
      crypto_payout_status: [
        "pending",
        "sending",
        "sent",
        "failed",
        "cancelled",
      ],
      escrow_status: ["held", "released", "refunded", "forfeited"],
      manual_payout_method: ["paypal", "cashapp"],
      manual_payout_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "canceled",
      ],
      wallet_tx_status: ["pending", "completed", "failed", "reversed"],
      wallet_tx_type: [
        "deposit",
        "withdrawal",
        "entry_fee",
        "prize_payout",
        "platform_fee",
        "refund",
        "escrow_hold",
        "escrow_release",
        "adjustment",
      ],
    },
  },
} as const
