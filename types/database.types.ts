/**
 * Database Types
 * Generated from Supabase schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type CallStatus = 'connected' | 'reception' | 'no_conversation'

export type Direction = 'inbound' | 'outbound'

export type PromptType = 'connected' | 'reception'

export type MaterialType = 'detail' | 'case_study'

export type FileType = 'pdf' | 'csv'

export type UserRole = 'owner' | 'director' | 'user'

export type ProjectMemberRole = 'director' | 'user'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          role: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          slack_webhook_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slack_webhook_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slack_webhook_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: ProjectMemberRole
          zoom_user_id: string | null
          phone_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: ProjectMemberRole
          zoom_user_id?: string | null
          phone_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: ProjectMemberRole
          zoom_user_id?: string | null
          phone_number?: string | null
          created_at?: string
        }
      }
      prompts: {
        Row: {
          id: string
          project_id: string | null
          prompt_type: PromptType
          content: string
          version: number
          created_by: string | null
          change_comment: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          prompt_type: PromptType
          content: string
          version?: number
          created_by?: string | null
          change_comment?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          prompt_type?: PromptType
          content?: string
          version?: number
          created_by?: string | null
          change_comment?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      talk_scripts: {
        Row: {
          id: string
          project_id: string
          version: number
          opening_script: string | null
          proposal_script: string | null
          closing_script: string | null
          created_by: string | null
          change_comment: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          version?: number
          opening_script?: string | null
          proposal_script?: string | null
          closing_script?: string | null
          created_by?: string | null
          change_comment?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          version?: number
          opening_script?: string | null
          proposal_script?: string | null
          closing_script?: string | null
          created_by?: string | null
          change_comment?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      talk_script_hearing_items: {
        Row: {
          id: string
          talk_script_id: string
          item_name: string
          item_script: string
          is_default: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          talk_script_id: string
          item_name: string
          item_script: string
          is_default?: boolean
          display_order: number
          created_at?: string
        }
        Update: {
          id?: string
          talk_script_id?: string
          item_name?: string
          item_script?: string
          is_default?: boolean
          display_order?: number
          created_at?: string
        }
      }
      learning_materials: {
        Row: {
          id: string
          project_id: string
          material_type: MaterialType
          file_name: string
          file_type: FileType
          file_url: string
          file_size_mb: number | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          material_type: MaterialType
          file_name: string
          file_type: FileType
          file_url: string
          file_size_mb?: number | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          material_type?: MaterialType
          file_name?: string
          file_type?: FileType
          file_url?: string
          file_size_mb?: number | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      learning_material_embeddings: {
        Row: {
          id: string
          material_id: string
          chunk_text: string
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          chunk_text: string
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          chunk_text?: string
          embedding?: number[] | null
          created_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          project_id: string | null
          user_id: string | null
          zoom_call_id: string
          zoom_recording_id: string
          direction: Direction | null
          caller_number: string | null
          callee_number: string | null
          duration_seconds: number | null
          call_time: string | null
          audio_url: string | null
          transcript_url: string | null
          status: CallStatus | null
          status_confidence: number | null
          feedback_text: string | null
          prompt_version_id: string | null
          talk_script_version_id: string | null
          overall_match_rate: number | null
          phase_match_rates: Json | null
          hearing_item_coverage: Json | null
          appointment_gained: boolean | null
          appointment_confirmed: boolean
          valid_lead: boolean | null
          valid_lead_confirmed: boolean
          ng_reason_id: string | null
          emotion_analysis_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          user_id?: string | null
          zoom_call_id: string
          zoom_recording_id: string
          direction?: Direction | null
          caller_number?: string | null
          callee_number?: string | null
          duration_seconds?: number | null
          call_time?: string | null
          audio_url?: string | null
          transcript_url?: string | null
          status?: CallStatus | null
          status_confidence?: number | null
          feedback_text?: string | null
          prompt_version_id?: string | null
          talk_script_version_id?: string | null
          overall_match_rate?: number | null
          phase_match_rates?: Json | null
          hearing_item_coverage?: Json | null
          appointment_gained?: boolean | null
          appointment_confirmed?: boolean
          valid_lead?: boolean | null
          valid_lead_confirmed?: boolean
          ng_reason_id?: string | null
          emotion_analysis_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          user_id?: string | null
          zoom_call_id?: string
          zoom_recording_id?: string
          direction?: Direction | null
          caller_number?: string | null
          callee_number?: string | null
          duration_seconds?: number | null
          call_time?: string | null
          audio_url?: string | null
          transcript_url?: string | null
          status?: CallStatus | null
          status_confidence?: number | null
          feedback_text?: string | null
          prompt_version_id?: string | null
          talk_script_version_id?: string | null
          overall_match_rate?: number | null
          phase_match_rates?: Json | null
          hearing_item_coverage?: Json | null
          appointment_gained?: boolean | null
          appointment_confirmed?: boolean
          valid_lead?: boolean | null
          valid_lead_confirmed?: boolean
          ng_reason_id?: string | null
          emotion_analysis_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ng_reasons: {
        Row: {
          id: string
          project_id: string | null
          reason_name: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          reason_name: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          reason_name?: string
          created_by?: string | null
          created_at?: string
        }
      }
      ng_reason_logs: {
        Row: {
          id: string
          call_id: string | null
          ng_reason_id: string | null
          call_date: string
          project_id: string | null
          user_id: string | null
          customer_phone: string | null
          ai_confidence: number | null
          evidence_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          call_id?: string | null
          ng_reason_id?: string | null
          call_date: string
          project_id?: string | null
          user_id?: string | null
          customer_phone?: string | null
          ai_confidence?: number | null
          evidence_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          call_id?: string | null
          ng_reason_id?: string | null
          call_date?: string
          project_id?: string | null
          user_id?: string | null
          customer_phone?: string | null
          ai_confidence?: number | null
          evidence_text?: string | null
          created_at?: string
        }
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
  }
}
