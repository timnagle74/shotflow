// Generated types for Supabase — matches the migration schema.
// In production, generate with: npx supabase gen types typescript

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'COORDINATOR' | 'ARTIST' | 'CLIENT' | 'VFX_VENDOR';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ShotStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'REVISIONS' | 'APPROVED' | 'FINAL';
export type ShotComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX' | 'HERO';
export type VersionStatus = 'WIP' | 'PENDING_REVIEW' | 'APPROVED' | 'REVISE' | 'CBB';
export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'ACCEPTED';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          role: UserRole;
          avatar: string | null;
          can_view_all_shots: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email: string;
          role: UserRole;
          avatar?: string | null;
          can_view_all_shots?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          role?: UserRole;
          avatar?: string | null;
          can_view_all_shots?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          code: string;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          status: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      sequences: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          code: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          code: string;
          sort_order: number;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          code?: string;
          sort_order?: number;
        };
      };
      shots: {
        Row: {
          id: string;
          sequence_id: string;
          code: string;
          description: string | null;
          status: ShotStatus;
          complexity: ShotComplexity;
          assigned_to_id: string | null;
          due_date: string | null;
          frame_start: number | null;
          frame_end: number | null;
          handle_head: number | null;
          handle_tail: number | null;
          plate_source: string | null;
          camera_data: Record<string, unknown> | null;
          edit_ref: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          code: string;
          description?: string | null;
          status: ShotStatus;
          complexity: ShotComplexity;
          assigned_to_id?: string | null;
          due_date?: string | null;
          frame_start?: number | null;
          frame_end?: number | null;
          handle_head?: number | null;
          handle_tail?: number | null;
          plate_source?: string | null;
          camera_data?: Record<string, unknown> | null;
          edit_ref?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sequence_id?: string;
          code?: string;
          description?: string | null;
          status?: ShotStatus;
          complexity?: ShotComplexity;
          assigned_to_id?: string | null;
          due_date?: string | null;
          frame_start?: number | null;
          frame_end?: number | null;
          handle_head?: number | null;
          handle_tail?: number | null;
          plate_source?: string | null;
          camera_data?: Record<string, unknown> | null;
          edit_ref?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      versions: {
        Row: {
          id: string;
          shot_id: string;
          version_number: number;
          created_by_id: string;
          status: VersionStatus;
          file_path: string | null;
          thumbnail_path: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          version_number: number;
          created_by_id: string;
          status: VersionStatus;
          file_path?: string | null;
          thumbnail_path?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shot_id?: string;
          version_number?: number;
          created_by_id?: string;
          status?: VersionStatus;
          file_path?: string | null;
          thumbnail_path?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          version_id: string;
          author_id: string;
          content: string;
          frame_reference: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          author_id: string;
          content: string;
          frame_reference?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          version_id?: string;
          author_id?: string;
          content?: string;
          frame_reference?: number | null;
          created_at?: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          shot_id: string;
          version_id: string;
          delivered_at: string | null;
          specs: Record<string, unknown> | null;
          status: DeliveryStatus;
        };
        Insert: {
          id?: string;
          shot_id: string;
          version_id: string;
          delivered_at?: string | null;
          specs?: Record<string, unknown> | null;
          status: DeliveryStatus;
        };
        Update: {
          id?: string;
          shot_id?: string;
          version_id?: string;
          delivered_at?: string | null;
          specs?: Record<string, unknown> | null;
          status?: DeliveryStatus;
        };
      };
      delivery_specs: {
        Row: {
          id: string;
          project_id: string;
          resolution: string | null;
          format: string | null;
          frame_rate: string | null;
          color_space: string | null;
          bit_depth: string | null;
          handles_head: number;
          handles_tail: number;
          naming_convention: string | null;
          audio_requirements: string | null;
          additional_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          resolution?: string | null;
          format?: string | null;
          frame_rate?: string | null;
          color_space?: string | null;
          bit_depth?: string | null;
          handles_head?: number;
          handles_tail?: number;
          naming_convention?: string | null;
          audio_requirements?: string | null;
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          resolution?: string | null;
          format?: string | null;
          frame_rate?: string | null;
          color_space?: string | null;
          bit_depth?: string | null;
          handles_head?: number;
          handles_tail?: number;
          naming_convention?: string | null;
          audio_requirements?: string | null;
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      turnovers: {
        Row: {
          id: string;
          project_id: string;
          source_file: string;
          imported_at: string;
          imported_by_id: string;
          shot_count: number;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_file: string;
          imported_at?: string;
          imported_by_id: string;
          shot_count: number;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_file?: string;
          imported_at?: string;
          imported_by_id?: string;
          shot_count?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      project_status: ProjectStatus;
      shot_status: ShotStatus;
      shot_complexity: ShotComplexity;
      version_status: VersionStatus;
      delivery_status: DeliveryStatus;
    };
  };
}
