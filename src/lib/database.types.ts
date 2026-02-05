// Generated types for Supabase — matches the migration schema.
// In production, generate with: npx supabase gen types typescript
// Last updated: 2026-02-04 (matches all migrations through 20260204_vendor_schema_fixes)

export type UserRole = 'ADMIN' | 'VFX_SUPERVISOR' | 'POST_SUPERVISOR' | 'SUPERVISOR' | 'PRODUCER' | 'COORDINATOR' | 'EDITOR' | 'ASSISTANT_EDITOR' | 'ARTIST' | 'VFX_EDITOR' | 'CLIENT' | 'VFX_VENDOR';
export type DeliverySpecType = 'EDITORIAL' | 'FINAL';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ShotStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'REVISIONS' | 'APPROVED' | 'FINAL';
export type ShotComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX' | 'HERO';
export type VersionStatus = 'WIP' | 'PENDING_REVIEW' | 'APPROVED' | 'REVISE' | 'CBB';
export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'ACCEPTED';

export type LutType = '1D' | '3D' | 'CDL';
export type LutFormat = '.cube' | '.3dl' | '.csp' | '.cdl';
export type CDLSource = 'ALE' | 'manual' | 'CDL file';

export interface Database {
  public: {
    Tables: {
      source_media: {
        Row: {
          id: string;
          project_id: string;
          clip_name: string;
          tape: string | null;
          uuid: string | null;
          tc_in: string | null;
          tc_out: string | null;
          tc_in_frames: number | null;
          tc_out_frames: number | null;
          fps: number;
          duration_frames: number | null;
          file_path: string | null;
          file_type: string | null;
          resolution: string | null;
          codec: string | null;
          camera: string | null;
          camera_id: string | null;
          camera_roll: string | null;
          lens: string | null;
          focal_length: string | null;
          focus_distance: string | null;
          f_stop: string | null;
          t_stop: string | null;
          iso: string | null;
          shutter: string | null;
          sensor_fps: string | null;
          white_balance: string | null;
          scene: string | null;
          take: string | null;
          circled: boolean;
          day_night: string | null;
          int_ext: string | null;
          location: string | null;
          director: string | null;
          dop: string | null;
          sound_roll: string | null;
          sound_tc: string | null;
          colorspace: string | null;
          look: string | null;
          lut: string | null;
          cdl_slope_r: number | null;
          cdl_slope_g: number | null;
          cdl_slope_b: number | null;
          cdl_offset_r: number | null;
          cdl_offset_g: number | null;
          cdl_offset_b: number | null;
          cdl_power_r: number | null;
          cdl_power_g: number | null;
          cdl_power_b: number | null;
          cdl_saturation: number | null;
          shoot_date: string | null;
          shoot_day: string | null;
          ale_source: string | null;
          imported_at: string;
          custom_metadata: Record<string, unknown> | null;
        };
        Insert: Omit<Database['public']['Tables']['source_media']['Row'], 'id' | 'imported_at'> & {
          id?: string;
          imported_at?: string;
        };
        Update: Partial<Database['public']['Tables']['source_media']['Insert']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          name: string | null;
          email: string;
          role: UserRole;
          avatar: string | null;
          can_view_all_shots: boolean;
          vendor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          name?: string | null;
          email: string;
          role: UserRole;
          avatar?: string | null;
          can_view_all_shots?: boolean;
          vendor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          name?: string | null;
          email?: string;
          role?: UserRole;
          avatar?: string | null;
          can_view_all_shots?: boolean;
          vendor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_vendors: {
        Row: {
          id: string;
          user_id: string;
          vendor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vendor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vendor_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          project_id: string | null;
          name: string;
          code: string | null;
          contact_name: string | null;
          contact_email: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          name: string;
          code?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          name?: string;
          code?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          vendor_id: string;
          user_id: string | null;
          name: string;
          email: string | null;
          role: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vendor_id: string;
          user_id?: string | null;
          name: string;
          email?: string | null;
          role?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vendor_id?: string;
          user_id?: string | null;
          name?: string;
          email?: string | null;
          role?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      sequences: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          code: string;
          sort_order: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          code: string;
          sort_order: number;
          notes?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          code?: string;
          sort_order?: number;
          notes?: string | null;
        };
        Relationships: [];
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
          // Source media link (20260201_source_media)
          source_media_id: string | null;
          source_clip_name: string | null;
          source_tc_in: string | null;
          source_tc_out: string | null;
          // Reposition data
          has_reposition: boolean;
          repo_scale: number | null;
          repo_scale_x: number | null;
          repo_scale_y: number | null;
          repo_position_x: number | null;
          repo_position_y: number | null;
          repo_rotation: number | null;
          // Speed data
          has_speed_change: boolean;
          speed_ratio: number | null;
          speed_reverse: boolean;
          speed_time_remap: boolean;
          // Record timeline position
          record_tc_in: string | null;
          record_tc_out: string | null;
          record_frame_in: number | null;
          record_frame_out: number | null;
        };
        Insert: {
          id?: string;
          sequence_id: string;
          code: string;
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
          source_media_id?: string | null;
          source_clip_name?: string | null;
          source_tc_in?: string | null;
          source_tc_out?: string | null;
          has_reposition?: boolean;
          repo_scale?: number | null;
          repo_scale_x?: number | null;
          repo_scale_y?: number | null;
          repo_position_x?: number | null;
          repo_position_y?: number | null;
          repo_rotation?: number | null;
          has_speed_change?: boolean;
          speed_ratio?: number | null;
          speed_reverse?: boolean;
          speed_time_remap?: boolean;
          record_tc_in?: string | null;
          record_tc_out?: string | null;
          record_frame_in?: number | null;
          record_frame_out?: number | null;
        };
        Update: Partial<Database['public']['Tables']['shots']['Insert']>;
        Relationships: [];
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
          preview_url: string | null;
          download_url: string | null;
          bunny_video_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          version_number: number;
          created_by_id: string;
          status?: VersionStatus;
          file_path?: string | null;
          thumbnail_path?: string | null;
          description?: string | null;
          preview_url?: string | null;
          download_url?: string | null;
          bunny_video_id?: string | null;
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
          preview_url?: string | null;
          download_url?: string | null;
          bunny_video_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shot_versions: {
        Row: {
          id: string;
          shot_id: string;
          turnover_shot_id: string | null;
          version_number: number;
          version_code: string | null;
          status: string;
          filename: string | null;
          storage_path: string | null;
          cdn_url: string | null;
          preview_url: string | null;
          video_id: string | null;
          file_size: number | null;
          submitted_at: string | null;
          submitted_by_id: string | null;
          reviewed_at: string | null;
          reviewed_by_id: string | null;
          review_notes: string | null;
          frame_count: number | null;
          frame_rate: number | null;
          resolution: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          turnover_shot_id?: string | null;
          version_number?: number;
          version_code?: string | null;
          status?: string;
          filename?: string | null;
          storage_path?: string | null;
          cdn_url?: string | null;
          preview_url?: string | null;
          video_id?: string | null;
          file_size?: number | null;
          submitted_at?: string | null;
          submitted_by_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by_id?: string | null;
          review_notes?: string | null;
          frame_count?: number | null;
          frame_rate?: number | null;
          resolution?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shot_versions']['Insert']>;
        Relationships: [];
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
        Relationships: [];
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
          status?: DeliveryStatus;
        };
        Update: {
          id?: string;
          shot_id?: string;
          version_id?: string;
          delivered_at?: string | null;
          specs?: Record<string, unknown> | null;
          status?: DeliveryStatus;
        };
        Relationships: [];
      };
      delivery_specs: {
        Row: {
          id: string;
          project_id: string;
          spec_type: DeliverySpecType;
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
          spec_type: DeliverySpecType;
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
          spec_type?: DeliverySpecType;
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
        Relationships: [];
      };
      turnovers: {
        Row: {
          id: string;
          project_id: string;
          sequence_id: string | null;
          turnover_number: number;
          turnover_date: string;
          title: string | null;
          general_notes: string | null;
          status: string | null;
          ref_filename: string | null;
          ref_storage_path: string | null;
          ref_cdn_url: string | null;
          ref_video_id: string | null;
          ref_preview_url: string | null;
          source_edl_filename: string | null;
          source_ale_filename: string | null;
          source_xml_filename: string | null;
          revision_number: number;
          parent_turnover_id: string | null;
          revision_notes: string | null;
          reviewed_at: string | null;
          reviewed_by_id: string | null;
          created_at: string;
          updated_at: string;
          created_by_id: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          sequence_id?: string | null;
          turnover_number?: number;
          turnover_date?: string;
          title?: string | null;
          general_notes?: string | null;
          status?: string | null;
          ref_filename?: string | null;
          ref_storage_path?: string | null;
          ref_cdn_url?: string | null;
          ref_video_id?: string | null;
          ref_preview_url?: string | null;
          source_edl_filename?: string | null;
          source_ale_filename?: string | null;
          source_xml_filename?: string | null;
          revision_number?: number;
          parent_turnover_id?: string | null;
          revision_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['turnovers']['Insert']>;
        Relationships: [];
      };
      turnover_shots: {
        Row: {
          id: string;
          turnover_id: string;
          shot_id: string;
          vfx_notes: string | null;
          source_in: string | null;
          source_out: string | null;
          record_in: string | null;
          record_out: string | null;
          duration_frames: number | null;
          clip_name: string | null;
          reel_name: string | null;
          vendor_id: string | null;
          artist_id: string | null;
          assigned_at: string | null;
          assigned_by_id: string | null;
          plates_assigned: boolean;
          refs_assigned: boolean;
          notes_complete: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          turnover_id: string;
          shot_id: string;
          vfx_notes?: string | null;
          source_in?: string | null;
          source_out?: string | null;
          record_in?: string | null;
          record_out?: string | null;
          duration_frames?: number | null;
          clip_name?: string | null;
          reel_name?: string | null;
          vendor_id?: string | null;
          artist_id?: string | null;
          assigned_at?: string | null;
          assigned_by_id?: string | null;
          plates_assigned?: boolean;
          refs_assigned?: boolean;
          notes_complete?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['turnover_shots']['Insert']>;
        Relationships: [];
      };
      turnover_refs: {
        Row: {
          id: string;
          turnover_id: string;
          filename: string;
          storage_path: string | null;
          cdn_url: string | null;
          file_size: number | null;
          video_id: string | null;
          preview_url: string | null;
          auto_matched: boolean;
          created_at: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          turnover_id: string;
          filename: string;
          storage_path?: string | null;
          cdn_url?: string | null;
          file_size?: number | null;
          video_id?: string | null;
          preview_url?: string | null;
          auto_matched?: boolean;
          created_at?: string;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['turnover_refs']['Insert']>;
        Relationships: [];
      };
      turnover_shot_refs: {
        Row: {
          id: string;
          turnover_shot_id: string;
          turnover_ref_id: string;
          auto_matched: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          turnover_shot_id: string;
          turnover_ref_id: string;
          auto_matched?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['turnover_shot_refs']['Insert']>;
        Relationships: [];
      };
      review_sessions: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          access_token: string;
          password_hash: string | null;
          expires_at: string | null;
          allow_comments: boolean;
          allow_approvals: boolean;
          watermark_text: string | null;
          created_at: string;
          created_by_id: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          access_token?: string;
          password_hash?: string | null;
          expires_at?: string | null;
          allow_comments?: boolean;
          allow_approvals?: boolean;
          watermark_text?: string | null;
          created_at?: string;
          created_by_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['review_sessions']['Insert']>;
        Relationships: [];
      };
      review_session_versions: {
        Row: {
          id: string;
          session_id: string;
          version_id: string;
          sort_order: number;
          client_status: string | null;
          client_notes: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          version_id: string;
          sort_order?: number;
          client_status?: string | null;
          client_notes?: string | null;
          reviewed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['review_session_versions']['Insert']>;
        Relationships: [];
      };
      version_comments: {
        Row: {
          id: string;
          version_id: string;
          session_id: string | null;
          comment_text: string;
          timecode_frame: number | null;
          author_name: string | null;
          author_email: string | null;
          author_user_id: string | null;
          is_client_comment: boolean;
          parent_comment_id: string | null;
          resolved: boolean;
          resolved_at: string | null;
          resolved_by_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          session_id?: string | null;
          comment_text: string;
          timecode_frame?: number | null;
          author_name?: string | null;
          author_email?: string | null;
          author_user_id?: string | null;
          is_client_comment?: boolean;
          parent_comment_id?: string | null;
          resolved?: boolean;
          resolved_at?: string | null;
          resolved_by_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['version_comments']['Insert']>;
        Relationships: [];
      };
      version_status_history: {
        Row: {
          id: string;
          version_id: string;
          from_status: string | null;
          to_status: string;
          changed_by_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          from_status?: string | null;
          to_status: string;
          changed_by_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['version_status_history']['Insert']>;
        Relationships: [];
      };
      shot_cdls: {
        Row: {
          id: string;
          shot_id: string;
          slope_r: number;
          slope_g: number;
          slope_b: number;
          offset_r: number;
          offset_g: number;
          offset_b: number;
          power_r: number;
          power_g: number;
          power_b: number;
          saturation: number;
          source: string | null;
          source_file: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          slope_r?: number;
          slope_g?: number;
          slope_b?: number;
          offset_r?: number;
          offset_g?: number;
          offset_b?: number;
          power_r?: number;
          power_g?: number;
          power_b?: number;
          saturation?: number;
          source?: string | null;
          source_file?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shot_id?: string;
          slope_r?: number;
          slope_g?: number;
          slope_b?: number;
          offset_r?: number;
          offset_g?: number;
          offset_b?: number;
          power_r?: number;
          power_g?: number;
          power_b?: number;
          saturation?: number;
          source?: string | null;
          source_file?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lut_files: {
        Row: {
          id: string;
          project_id: string | null;
          shot_id: string | null;
          name: string;
          lut_type: string;
          format: string | null;
          file_path: string | null;
          file_size: number | null;
          description: string | null;
          is_default: boolean;
          uploaded_by_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          shot_id?: string | null;
          name: string;
          lut_type: string;
          format?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          description?: string | null;
          is_default?: boolean;
          uploaded_by_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          shot_id?: string | null;
          name?: string;
          lut_type?: string;
          format?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          description?: string | null;
          is_default?: boolean;
          uploaded_by_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shot_metadata: {
        Row: {
          id: string;
          shot_id: string;
          tape: string | null;
          scene: string | null;
          take: string | null;
          circled: boolean;
          camera: string | null;
          camera_roll: string | null;
          lens: string | null;
          focal_length: string | null;
          focus_distance: string | null;
          f_stop: string | null;
          t_stop: string | null;
          ei_iso: string | null;
          shutter: string | null;
          sensor_fps: string | null;
          white_balance: string | null;
          colorspace: string | null;
          look_info: string | null;
          codec: string | null;
          src_resolution: string | null;
          src_filetype: string | null;
          filepath: string | null;
          sound_roll: string | null;
          sound_tc: string | null;
          dop: string | null;
          director: string | null;
          gps_position: string | null;
          shoot_date: string | null;
          day_night: string | null;
          int_ext: string | null;
          duration: string | null;
          uuid_ref: string | null;
          lut_nodes: string | null;
          custom_metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          tape?: string | null;
          scene?: string | null;
          take?: string | null;
          circled?: boolean;
          camera?: string | null;
          camera_roll?: string | null;
          lens?: string | null;
          focal_length?: string | null;
          focus_distance?: string | null;
          f_stop?: string | null;
          t_stop?: string | null;
          ei_iso?: string | null;
          shutter?: string | null;
          sensor_fps?: string | null;
          white_balance?: string | null;
          colorspace?: string | null;
          look_info?: string | null;
          codec?: string | null;
          src_resolution?: string | null;
          src_filetype?: string | null;
          filepath?: string | null;
          sound_roll?: string | null;
          sound_tc?: string | null;
          dop?: string | null;
          director?: string | null;
          gps_position?: string | null;
          shoot_date?: string | null;
          day_night?: string | null;
          int_ext?: string | null;
          duration?: string | null;
          uuid_ref?: string | null;
          lut_nodes?: string | null;
          custom_metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shot_id?: string;
          tape?: string | null;
          scene?: string | null;
          take?: string | null;
          circled?: boolean;
          camera?: string | null;
          camera_roll?: string | null;
          lens?: string | null;
          focal_length?: string | null;
          focus_distance?: string | null;
          f_stop?: string | null;
          t_stop?: string | null;
          ei_iso?: string | null;
          shutter?: string | null;
          sensor_fps?: string | null;
          white_balance?: string | null;
          colorspace?: string | null;
          look_info?: string | null;
          codec?: string | null;
          src_resolution?: string | null;
          src_filetype?: string | null;
          filepath?: string | null;
          sound_roll?: string | null;
          sound_tc?: string | null;
          dop?: string | null;
          director?: string | null;
          gps_position?: string | null;
          shoot_date?: string | null;
          day_night?: string | null;
          int_ext?: string | null;
          duration?: string | null;
          uuid_ref?: string | null;
          lut_nodes?: string | null;
          custom_metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_source_media_stats: {
        Args: { p_project_id: string };
        Returns: {
          totalClips: number;
          shootDates: number;
          cameras: number;
          scenes: number;
          withCDL: number;
        };
      };
      create_turnover_atomic: {
        Args: {
          p_project_id: string;
          p_sequence_id?: string | null;
          p_title?: string | null;
          p_general_notes?: string | null;
          p_source_edl_filename?: string | null;
          p_status?: string;
        };
        Returns: {
          id: string;
          turnover_number: number;
          project_id: string;
          sequence_id: string | null;
          title: string;
        }[];
      };
    };
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
