// Generated types for Supabase — matches the migration schema.
// In production, generate with: npx supabase gen types typescript

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'COORDINATOR' | 'ARTIST' | 'CLIENT' | 'VFX_VENDOR';
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
      };
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
          // Source media link
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
          // Source media link
          source_media_id?: string | null;
          source_clip_name?: string | null;
          source_tc_in?: string | null;
          source_tc_out?: string | null;
          // Reposition data
          has_reposition?: boolean;
          repo_scale?: number | null;
          repo_scale_x?: number | null;
          repo_scale_y?: number | null;
          repo_position_x?: number | null;
          repo_position_y?: number | null;
          repo_rotation?: number | null;
          // Speed data
          has_speed_change?: boolean;
          speed_ratio?: number | null;
          speed_reverse?: boolean;
          speed_time_remap?: boolean;
          // Record timeline position
          record_tc_in?: string | null;
          record_tc_out?: string | null;
          record_frame_in?: number | null;
          record_frame_out?: number | null;
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
          status: VersionStatus;
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
