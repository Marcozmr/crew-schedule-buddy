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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      documents: {
        Row: {
          category: string
          file_name: string
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          category?: string
          file_name: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          category?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          route: string | null
          status: string
          subject: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          route?: string | null
          status?: string
          subject?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          route?: string | null
          status?: string
          subject?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_swap_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          offer_id: string
          sender_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          offer_id: string
          sender_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          offer_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_swap_messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "flight_swap_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_swap_offers: {
        Row: {
          arrival_airport: string | null
          created_at: string
          departure_airport: string | null
          flight_date: string | null
          flight_number: string | null
          id: string
          interest_count: number
          notes: string | null
          owner_user_id: string
          schedule_entry_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arrival_airport?: string | null
          created_at?: string
          departure_airport?: string | null
          flight_date?: string | null
          flight_number?: string | null
          id?: string
          interest_count?: number
          notes?: string | null
          owner_user_id: string
          schedule_entry_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arrival_airport?: string | null
          created_at?: string
          departure_airport?: string | null
          flight_date?: string | null
          flight_number?: string | null
          id?: string
          interest_count?: number
          notes?: string | null
          owner_user_id?: string
          schedule_entry_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_swap_offers_schedule_entry_id_fkey"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_swap_proposals: {
        Row: {
          created_at: string
          id: string
          message: string | null
          offer_id: string
          proposed_schedule_entry_id: string | null
          proposer_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          offer_id: string
          proposed_schedule_entry_id?: string | null
          proposer_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          offer_id?: string
          proposed_schedule_entry_id?: string | null
          proposer_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_swap_proposals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "flight_swap_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_swap_proposals_proposed_schedule_entry_id_fkey"
            columns: ["proposed_schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_swap_requests: {
        Row: {
          created_at: string
          flight_date: string | null
          flight_number: string | null
          id: string
          notes: string | null
          schedule_entry_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_date?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          schedule_entry_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flight_date?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          schedule_entry_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_swap_requests_schedule_entry_id_fkey"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_rosters: {
        Row: {
          base_airport: string | null
          connector_key: string | null
          created_at: string
          crew_group_code: string | null
          crew_role: string | null
          duty_hours_total: number | null
          employee_code: string | null
          file_name: string
          flying_hours_total: number | null
          id: string
          import_error: string | null
          import_origin: string
          import_status: string | null
          inserted_count: number | null
          is_active: boolean
          name: string | null
          parsed_count: number | null
          parser_version: string | null
          portal_connection_id: string | null
          raw_text_excerpt: string | null
          roster_end_date: string | null
          roster_start_date: string | null
          source_message_id: string
          storage_path: string
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_airport?: string | null
          connector_key?: string | null
          created_at?: string
          crew_group_code?: string | null
          crew_role?: string | null
          duty_hours_total?: number | null
          employee_code?: string | null
          file_name?: string
          flying_hours_total?: number | null
          id?: string
          import_error?: string | null
          import_origin?: string
          import_status?: string | null
          inserted_count?: number | null
          is_active?: boolean
          name?: string | null
          parsed_count?: number | null
          parser_version?: string | null
          portal_connection_id?: string | null
          raw_text_excerpt?: string | null
          roster_end_date?: string | null
          roster_start_date?: string | null
          source_message_id: string
          storage_path: string
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_airport?: string | null
          connector_key?: string | null
          created_at?: string
          crew_group_code?: string | null
          crew_role?: string | null
          duty_hours_total?: number | null
          employee_code?: string | null
          file_name?: string
          flying_hours_total?: number | null
          id?: string
          import_error?: string | null
          import_origin?: string
          import_status?: string | null
          inserted_count?: number | null
          is_active?: boolean
          name?: string | null
          parsed_count?: number | null
          parser_version?: string | null
          portal_connection_id?: string | null
          raw_text_excerpt?: string | null
          roster_end_date?: string | null
          roster_start_date?: string | null
          source_message_id?: string
          storage_path?: string
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_rosters_portal_connection_id_fkey"
            columns: ["portal_connection_id"]
            isOneToOne: false
            referencedRelation: "portal_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      perdiem_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          location: string | null
          notes: string | null
          quantity: number | null
          related_schedule_entry_id: string | null
          total_value: number | null
          unit_value: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number | null
          related_schedule_entry_id?: string | null
          total_value?: number | null
          unit_value?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number | null
          related_schedule_entry_id?: string | null
          total_value?: number | null
          unit_value?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perdiem_entries_related_schedule_entry_id_fkey"
            columns: ["related_schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_connections: {
        Row: {
          connected_at: string | null
          connection_status: string
          connector_key: string
          created_at: string
          disconnected_at: string | null
          display_name: string
          id: string
          last_error: string | null
          last_successful_sync_at: string | null
          last_synced_at: string | null
          metadata: Json
          session_expires_at: string | null
          source_kind: string
          sync_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connection_status?: string
          connector_key: string
          created_at?: string
          disconnected_at?: string | null
          display_name?: string
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          session_expires_at?: string | null
          source_kind?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connection_status?: string
          connector_key?: string
          created_at?: string
          disconnected_at?: string | null
          display_name?: string
          id?: string
          last_error?: string | null
          last_successful_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          session_expires_at?: string | null
          source_kind?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_sync_runs: {
        Row: {
          completed_at: string | null
          connection_id: string
          connector_key: string
          details: Json
          error_message: string | null
          id: string
          imported_count: number
          parsed_count: number
          roster_id: string | null
          run_status: string
          source_kind: string
          started_at: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          connector_key: string
          details?: Json
          error_message?: string | null
          id?: string
          imported_count?: number
          parsed_count?: number
          roster_id?: string | null
          run_status?: string
          source_kind?: string
          started_at?: string
          trigger_type?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          connector_key?: string
          details?: Json
          error_message?: string | null
          id?: string
          imported_count?: number
          parsed_count?: number
          roster_id?: string | null
          run_status?: string
          source_kind?: string
          started_at?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "portal_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sync_runs_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          airline: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          registration: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          airline?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          registration?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          airline?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          registration?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regulation_alerts: {
        Row: {
          description: string | null
          detected_at: string
          id: string
          is_active: boolean | null
          roster_id: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          description?: string | null
          detected_at?: string
          id?: string
          is_active?: boolean | null
          roster_id?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          description?: string | null
          detected_at?: string
          id?: string
          is_active?: boolean | null
          roster_id?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulation_alerts_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_rules: {
        Row: {
          crew_type: string | null
          id: string
          is_active: boolean | null
          max_duty_hours: number | null
          max_flight_hours: number | null
          min_rest_hours: number | null
          period_type: string | null
          rest_class: string | null
          rule_type: string
          stage_count: number | null
        }
        Insert: {
          crew_type?: string | null
          id?: string
          is_active?: boolean | null
          max_duty_hours?: number | null
          max_flight_hours?: number | null
          min_rest_hours?: number | null
          period_type?: string | null
          rest_class?: string | null
          rule_type: string
          stage_count?: number | null
        }
        Update: {
          crew_type?: string | null
          id?: string
          is_active?: boolean | null
          max_duty_hours?: number | null
          max_flight_hours?: number | null
          min_rest_hours?: number | null
          period_type?: string | null
          rest_class?: string | null
          rule_type?: string
          stage_count?: number | null
        }
        Relationships: []
      }
      salary_entries: {
        Row: {
          base_salary: number | null
          created_at: string
          gross_total: number | null
          health_plan: number | null
          id: string
          inss: number | null
          irrf: number | null
          net_total: number | null
          night_additional: number | null
          notes: string | null
          other_additions: number | null
          other_discounts: number | null
          overnight_total: number | null
          per_diem_total: number | null
          productivity_bonus: number | null
          reference_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          gross_total?: number | null
          health_plan?: number | null
          id?: string
          inss?: number | null
          irrf?: number | null
          net_total?: number | null
          night_additional?: number | null
          notes?: string | null
          other_additions?: number | null
          other_discounts?: number | null
          overnight_total?: number | null
          per_diem_total?: number | null
          productivity_bonus?: number | null
          reference_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          gross_total?: number | null
          health_plan?: number | null
          id?: string
          inss?: number | null
          irrf?: number | null
          net_total?: number | null
          night_additional?: number | null
          notes?: string | null
          other_additions?: number | null
          other_discounts?: number | null
          overnight_total?: number | null
          per_diem_total?: number | null
          productivity_bonus?: number | null
          reference_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_entries: {
        Row: {
          activity_type: string
          aircraft_prefix: string | null
          aircraft_type: string | null
          airline: string | null
          arrival: string
          arrival_airport: string | null
          arrival_time: string
          assignment: string | null
          comments: string | null
          created_at: string
          crew_role: string | null
          crosses_midnight: boolean | null
          date: string
          debrief_time: string | null
          departure: string
          departure_airport: string | null
          departure_time: string
          duty_hours: number | null
          flight_hours: number | null
          flight_number: string
          hotel_name: string | null
          id: string
          is_flight: boolean
          operation_type: string | null
          overnight: boolean | null
          pairing_code: string | null
          raw_line: string | null
          report_time: string | null
          roster_id: string
          sort_datetime: string | null
          source_pdf_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          aircraft_prefix?: string | null
          aircraft_type?: string | null
          airline?: string | null
          arrival?: string
          arrival_airport?: string | null
          arrival_time?: string
          assignment?: string | null
          comments?: string | null
          created_at?: string
          crew_role?: string | null
          crosses_midnight?: boolean | null
          date: string
          debrief_time?: string | null
          departure?: string
          departure_airport?: string | null
          departure_time?: string
          duty_hours?: number | null
          flight_hours?: number | null
          flight_number: string
          hotel_name?: string | null
          id?: string
          is_flight?: boolean
          operation_type?: string | null
          overnight?: boolean | null
          pairing_code?: string | null
          raw_line?: string | null
          report_time?: string | null
          roster_id: string
          sort_datetime?: string | null
          source_pdf_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          aircraft_prefix?: string | null
          aircraft_type?: string | null
          airline?: string | null
          arrival?: string
          arrival_airport?: string | null
          arrival_time?: string
          assignment?: string | null
          comments?: string | null
          created_at?: string
          crew_role?: string | null
          crosses_midnight?: boolean | null
          date?: string
          debrief_time?: string | null
          departure?: string
          departure_airport?: string | null
          departure_time?: string
          duty_hours?: number | null
          flight_hours?: number | null
          flight_number?: string
          hotel_name?: string | null
          id?: string
          is_flight?: boolean
          operation_type?: string | null
          overnight?: boolean | null
          pairing_code?: string | null
          raw_line?: string | null
          report_time?: string | null
          roster_id?: string
          sort_datetime?: string | null
          source_pdf_path?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          base_airport: string | null
          company_name: string | null
          created_at: string
          crew_role: string | null
          id: string
          notifications_enabled: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_airport?: string | null
          company_name?: string | null
          created_at?: string
          crew_role?: string | null
          id?: string
          notifications_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_airport?: string | null
          company_name?: string | null
          created_at?: string
          crew_role?: string | null
          id?: string
          notifications_enabled?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weather_recent_searches: {
        Row: {
          airport_code: string
          id: string
          searched_at: string
          user_id: string
        }
        Insert: {
          airport_code: string
          id?: string
          searched_at?: string
          user_id: string
        }
        Update: {
          airport_code?: string
          id?: string
          searched_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
