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
      auth_audit_events: {
        Row: {
          client_origin: string | null
          client_route: string | null
          created_at: string
          event_name: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          client_origin?: string | null
          client_route?: string | null
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          client_origin?: string | null
          client_route?: string | null
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limit_buckets: {
        Row: {
          bucket_key: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          artifact_base_path: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          fsm_state: string | null
          id: string
          imported_roster_id: string | null
          last_success_fsm_state: string | null
          orchestration_snapshot: Json
          requested_month: string | null
          session_id: string
          started_at: string
          status: string
          step_logs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          artifact_base_path?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          fsm_state?: string | null
          id?: string
          imported_roster_id?: string | null
          last_success_fsm_state?: string | null
          orchestration_snapshot?: Json
          requested_month?: string | null
          session_id: string
          started_at?: string
          status?: string
          step_logs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          artifact_base_path?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          fsm_state?: string | null
          id?: string
          imported_roster_id?: string | null
          last_success_fsm_state?: string | null
          orchestration_snapshot?: Json
          requested_month?: string | null
          session_id?: string
          started_at?: string
          status?: string
          step_logs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_imported_roster_id_fkey"
            columns: ["imported_roster_id"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "automation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sessions: {
        Row: {
          created_at: string
          encrypted_session_blob: string | null
          id: string
          last_error: string | null
          provider: string
          session_valid_until: string | null
          status: string
          storage_state_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_session_blob?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          session_valid_until?: string | null
          status?: string
          storage_state_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_session_blob?: string | null
          id?: string
          last_error?: string | null
          provider?: string
          session_valid_until?: string | null
          status?: string
          storage_state_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crew_conversation_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "crew_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      crew_days_off_matches: {
        Row: {
          created_at: string
          day_off: string
          id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          day_off: string
          id?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          day_off?: string
          id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      crew_flight_connections: {
        Row: {
          airline: string | null
          arrival: string | null
          created_at: string
          departure: string | null
          flight_date: string
          flight_number: string
          id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          airline?: string | null
          arrival?: string | null
          created_at?: string
          departure?: string | null
          flight_date: string
          flight_number: string
          id?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          airline?: string | null
          arrival?: string | null
          created_at?: string
          departure?: string | null
          flight_date?: string
          flight_number?: string
          id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      crew_layover_matches: {
        Row: {
          city: string
          created_at: string
          id: string
          layover_date: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          layover_date: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          layover_date?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
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
      flight_search_daily_usage: {
        Row: {
          search_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          search_count?: number
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          search_count?: number
          updated_at?: string
          usage_date?: string
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
      flights_cache: {
        Row: {
          airline: string | null
          airport: string | null
          cache_key: string
          created_at: string
          direction: string | null
          flight_date: string
          flight_number: string | null
          id: string
          mode: string
          response_json: Json
          source: string
          updated_at: string
        }
        Insert: {
          airline?: string | null
          airport?: string | null
          cache_key: string
          created_at?: string
          direction?: string | null
          flight_date: string
          flight_number?: string | null
          id?: string
          mode: string
          response_json: Json
          source?: string
          updated_at?: string
        }
        Update: {
          airline?: string | null
          airport?: string | null
          cache_key?: string
          created_at?: string
          direction?: string | null
          flight_date?: string
          flight_number?: string | null
          id?: string
          mode?: string
          response_json?: Json
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      imported_rosters: {
        Row: {
          automation_run_id: string | null
          base_airport: string | null
          connector_key: string | null
          content_sha256: string | null
          created_at: string
          crew_group_code: string | null
          crew_role: string | null
          duty_hours_total: number | null
          employee_code: string | null
          file_name: string
          file_size_bytes: number | null
          flying_hours_total: number | null
          id: string
          import_error: string | null
          import_origin: string
          import_status: string | null
          imported_at: string
          inserted_count: number | null
          is_active: boolean
          is_official_crew_roster_pdf: boolean
          last_sync_at: string | null
          name: string | null
          parsed_count: number | null
          parser_version: string | null
          portal_connection_id: string | null
          raw_text_excerpt: string | null
          roster_end_date: string | null
          roster_provider: string | null
          roster_source: string
          roster_start_date: string | null
          roster_status: string
          source_message_id: string
          source_type: string | null
          storage_path: string
          superseded_by: string | null
          superseded_by_roster_id: string | null
          sync_status: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_run_id?: string | null
          base_airport?: string | null
          connector_key?: string | null
          content_sha256?: string | null
          created_at?: string
          crew_group_code?: string | null
          crew_role?: string | null
          duty_hours_total?: number | null
          employee_code?: string | null
          file_name?: string
          file_size_bytes?: number | null
          flying_hours_total?: number | null
          id?: string
          import_error?: string | null
          import_origin?: string
          import_status?: string | null
          imported_at?: string
          inserted_count?: number | null
          is_active?: boolean
          is_official_crew_roster_pdf?: boolean
          last_sync_at?: string | null
          name?: string | null
          parsed_count?: number | null
          parser_version?: string | null
          portal_connection_id?: string | null
          raw_text_excerpt?: string | null
          roster_end_date?: string | null
          roster_provider?: string | null
          roster_source?: string
          roster_start_date?: string | null
          roster_status?: string
          source_message_id: string
          source_type?: string | null
          storage_path: string
          superseded_by?: string | null
          superseded_by_roster_id?: string | null
          sync_status?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_run_id?: string | null
          base_airport?: string | null
          connector_key?: string | null
          content_sha256?: string | null
          created_at?: string
          crew_group_code?: string | null
          crew_role?: string | null
          duty_hours_total?: number | null
          employee_code?: string | null
          file_name?: string
          file_size_bytes?: number | null
          flying_hours_total?: number | null
          id?: string
          import_error?: string | null
          import_origin?: string
          import_status?: string | null
          imported_at?: string
          inserted_count?: number | null
          is_active?: boolean
          is_official_crew_roster_pdf?: boolean
          last_sync_at?: string | null
          name?: string | null
          parsed_count?: number | null
          parser_version?: string | null
          portal_connection_id?: string | null
          raw_text_excerpt?: string | null
          roster_end_date?: string | null
          roster_provider?: string | null
          roster_source?: string
          roster_start_date?: string | null
          roster_status?: string
          source_message_id?: string
          source_type?: string | null
          storage_path?: string
          superseded_by?: string | null
          superseded_by_roster_id?: string | null
          sync_status?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_rosters_automation_run_id_fkey"
            columns: ["automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_rosters_portal_connection_id_fkey"
            columns: ["portal_connection_id"]
            isOneToOne: false
            referencedRelation: "portal_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_rosters_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_rosters_superseded_by_roster_id_fkey"
            columns: ["superseded_by_roster_id"]
            isOneToOne: false
            referencedRelation: "imported_rosters"
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
          last_reconnect_attempt_at: string | null
          last_successful_sync_at: string | null
          last_sync_attempt_at: string | null
          last_synced_at: string | null
          metadata: Json
          next_sync_at: string | null
          reconnect_attempts: number
          session_expires_at: string | null
          source_kind: string
          sync_attempts: number
          sync_enabled: boolean
          sync_error: string | null
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
          last_reconnect_attempt_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_attempt_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          next_sync_at?: string | null
          reconnect_attempts?: number
          session_expires_at?: string | null
          source_kind?: string
          sync_attempts?: number
          sync_enabled?: boolean
          sync_error?: string | null
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
          last_reconnect_attempt_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_attempt_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          next_sync_at?: string | null
          reconnect_attempts?: number
          session_expires_at?: string | null
          source_kind?: string
          sync_attempts?: number
          sync_enabled?: boolean
          sync_error?: string | null
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
          activity_label: string | null
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
          crew_status_code: string | null
          crew_status_label: string | null
          crosses_midnight: boolean | null
          date: string
          debrief_time: string | null
          departure: string
          departure_airport: string | null
          departure_time: string
          duty_hours: number | null
          entry_type: string | null
          flight_hours: number | null
          flight_number: string
          hotel_name: string | null
          id: string
          is_flight: boolean
          next_tracking_check_at: string | null
          operation_type: string | null
          overnight: boolean | null
          pairing_code: string | null
          raw_line: string | null
          report_time: string | null
          roster_id: string
          sort_datetime: string | null
          source_pdf_path: string | null
          status: string
          tracking_priority: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_label?: string | null
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
          crew_status_code?: string | null
          crew_status_label?: string | null
          crosses_midnight?: boolean | null
          date: string
          debrief_time?: string | null
          departure?: string
          departure_airport?: string | null
          departure_time?: string
          duty_hours?: number | null
          entry_type?: string | null
          flight_hours?: number | null
          flight_number: string
          hotel_name?: string | null
          id?: string
          is_flight?: boolean
          next_tracking_check_at?: string | null
          operation_type?: string | null
          overnight?: boolean | null
          pairing_code?: string | null
          raw_line?: string | null
          report_time?: string | null
          roster_id: string
          sort_datetime?: string | null
          source_pdf_path?: string | null
          status?: string
          tracking_priority?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_label?: string | null
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
          crew_status_code?: string | null
          crew_status_label?: string | null
          crosses_midnight?: boolean | null
          date?: string
          debrief_time?: string | null
          departure?: string
          departure_airport?: string | null
          departure_time?: string
          duty_hours?: number | null
          entry_type?: string | null
          flight_hours?: number | null
          flight_number?: string
          hotel_name?: string | null
          id?: string
          is_flight?: boolean
          next_tracking_check_at?: string | null
          operation_type?: string | null
          overnight?: boolean | null
          pairing_code?: string | null
          raw_line?: string | null
          report_time?: string | null
          roster_id?: string
          sort_datetime?: string | null
          source_pdf_path?: string | null
          status?: string
          tracking_priority?: string | null
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
      user_roster_connection: {
        Row: {
          automation_session_id: string | null
          connected_at: string | null
          connection_status: string
          connection_type: string
          created_at: string
          current_active_roster_id: string | null
          id: string
          is_auto_update_enabled: boolean
          last_checked_at: string | null
          last_error: string | null
          last_successful_import_at: string | null
          roster_connection_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_session_id?: string | null
          connected_at?: string | null
          connection_status?: string
          connection_type: string
          created_at?: string
          current_active_roster_id?: string | null
          id?: string
          is_auto_update_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_successful_import_at?: string | null
          roster_connection_state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_session_id?: string | null
          connected_at?: string | null
          connection_status?: string
          connection_type?: string
          created_at?: string
          current_active_roster_id?: string | null
          id?: string
          is_auto_update_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          last_successful_import_at?: string | null
          roster_connection_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roster_connection_automation_session_id_fkey"
            columns: ["automation_session_id"]
            isOneToOne: false
            referencedRelation: "automation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roster_connection_current_active_roster_id_fkey"
            columns: ["current_active_roster_id"]
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
          detected_base_airport: string | null
          home_base_source: string | null
          home_base_user_locked: boolean
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
          detected_base_airport?: string | null
          home_base_source?: string | null
          home_base_user_locked?: boolean
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
          detected_base_airport?: string | null
          home_base_source?: string | null
          home_base_user_locked?: boolean
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
      _auth_rate_limit_try_increment: {
        Args: {
          p_bucket_key: string
          p_max_requests: number
          p_now: string
          p_window: string
        }
        Returns: boolean
      }
      auth_rate_limit_check: {
        Args: { p_action: string; p_email: string; p_ip: string }
        Returns: Json
      }
      flight_search_try_increment: {
        Args: { p_daily_limit: number; p_user_id: string }
        Returns: Json
      }
      get_flight_crewmates: {
        Args: { p_date: string; p_departure: string; p_flight_number: string }
        Returns: {
          airline: string
          crew_role: string
          name: string
          user_id: string
        }[]
      }
      get_roster_crewmates: {
        Args: never
        Returns: {
          arrival: string
          crew_role: string
          departure: string
          flight_date: string
          flight_number: string
          partner_airline: string
          partner_name: string
          partner_user_id: string
        }[]
      }
      get_shared_days_off: {
        Args: { p_partner_id: string }
        Returns: {
          day_off: string
        }[]
      }
      get_shared_layovers: {
        Args: { p_partner_id: string }
        Returns: {
          city: string
          layover_date: string
        }[]
      }
      keep_alive_ping: { Args: never; Returns: string }
      list_crew_connections: {
        Args: never
        Returns: {
          conversation_id: string
          flights_together_count: number
          has_conversation: boolean
          partner_airline: string
          partner_name: string
          partner_user_id: string
        }[]
      }
      log_auth_audit_event: {
        Args: {
          p_event_name: string
          p_metadata?: Json
          p_origin?: string
          p_route?: string
        }
        Returns: undefined
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
