// Generated types for Supabase — matches the migration schema.
// In production, generate with: npx supabase gen types typescript

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'ARTIST' | 'CLIENT';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ShotStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'APPROVED' | 'FINAL';
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      sequences: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          code: string;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['sequences']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['sequences']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['shots']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shots']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['versions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['versions']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['notes']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notes']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['deliveries']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['deliveries']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['turnovers']['Row'], 'id' | 'imported_at'> & {
          id?: string;
          imported_at?: string;
        };
        Update: Partial<Database['public']['Tables']['turnovers']['Insert']>;
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
