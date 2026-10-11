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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      checkout_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          token: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          created_at: string
          id: string
          messages: Json
          progress: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          messages?: Json
          progress?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          progress?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string
          content: string
          created_at: string
          entitlement_state: string
          error_message: string | null
          id: string
          metadata: Json
          project_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          asset_type: string
          content?: string
          created_at?: string
          entitlement_state?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          project_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          asset_type?: string
          content?: string
          created_at?: string
          entitlement_state?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          content: Json
          created_at: string
          entitlement_state: string
          id: string
          interview_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          content?: Json
          created_at?: string
          entitlement_state?: string
          id: string
          interview_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          content?: Json
          created_at?: string
          entitlement_state?: string
          id?: string
          interview_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          builds_used: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interviews_used: number
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          builds_used?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interviews_used?: number
          plan: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          builds_used?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interviews_used?: number
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_started_at?: string | null
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
      acquire_checkout_lock: {
        Args: { p_lease_seconds: number; p_token: string; p_user_id: string }
        Returns: boolean
      }
      checkout_lock_lease: {
        Args: { p_lease_seconds: number }
        Returns: unknown
      }
      claim_stripe_customer: {
        Args: { p_customer_id: string; p_user_id: string }
        Returns: {
          claimed: boolean
          stored_customer_id: string
        }[]
      }
      hke_begin_asset_generation: {
        Args: {
          p_asset_type: string
          p_project_id: string
          p_skip_entitlement?: boolean
          p_title: string
          p_user_id: string
        }
        Returns: {
          build_credit_limit: number
          build_credits_used: number
          claimed_asset_id: string
          claimed_version: number
          denial_reason: string
          plan_name: string
        }[]
      }
      hke_begin_blueprint_generation: {
        Args: {
          p_interview_id: string
          p_project_id: string
          p_skip_entitlement?: boolean
          p_title: string
          p_user_id: string
        }
        Returns: {
          build_credit_limit: number
          build_credits_used: number
          claimed_project_id: string
          denial_reason: string
          interview_credit_limit: number
          interview_credits_used: number
          plan_name: string
        }[]
      }
      hke_expire_stale_asset_generations: {
        Args: { p_project_id: string }
        Returns: number
      }
      hke_finish_asset_generation: {
        Args: {
          p_asset_id: string
          p_content: string
          p_error: string
          p_metadata: Json
          p_succeeded: boolean
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      hke_finish_blueprint_generation: {
        Args: {
          p_content: Json
          p_interview_messages: Json
          p_interview_progress: number
          p_project_id: string
          p_succeeded: boolean
          p_user_id: string
        }
        Returns: string
      }
      hke_save_project_section: {
        Args: { p_project_id: string; p_section: string; p_value: Json }
        Returns: string
      }
      release_build: { Args: { p_user_id: string }; Returns: undefined }
      release_checkout_lock: {
        Args: { p_token: string; p_user_id: string }
        Returns: boolean
      }
      release_generation: { Args: { p_user_id: string }; Returns: undefined }
      renew_checkout_lock: {
        Args: { p_lease_seconds: number; p_token: string; p_user_id: string }
        Returns: boolean
      }
      start_trial: { Args: never; Returns: undefined }
      try_consume_build: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          build_limit: number
          builds_used: number
          plan: string
        }[]
      }
      try_consume_generation: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          build_limit: number
          builds_used: number
          denial_reason: string
          interview_limit: number
          interviews_used: number
          plan: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
