import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireInternal, getServiceClient } from '@/lib/auth';

const BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  try {
    // Auth: internal team only
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const roleCheck = requireInternal(auth.user);
    if (roleCheck) return roleCheck;

    const supabase = getServiceClient();
    const { records, projectId } = await request.json();
    
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 });
    }
    
    if (!projectId) {
      return NextResponse.json({ error: 'No projectId provided' }, { status: 400 });
    }
    
    // Process in batches
    const results = {
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      // Map records to database format
      const dbRecords = batch.map((r: any) => ({
        project_id: projectId,
        clip_name: r.clip_name,
        tape: r.tape,
        uuid: r.uuid,
        tc_in: r.tc_in,
        tc_out: r.tc_out,
        tc_in_frames: r.tc_in_frames,
        tc_out_frames: r.tc_out_frames,
        fps: r.fps,
        duration_frames: r.duration_frames,
        file_path: r.file_path,
        file_type: r.file_type,
        resolution: r.resolution,
        codec: r.codec,
        camera: r.camera,
        camera_id: r.camera_id,
        camera_roll: r.camera_roll,
        lens: r.lens,
        focal_length: r.focal_length,
        focus_distance: r.focus_distance,
        f_stop: r.f_stop,
        t_stop: r.t_stop,
        iso: r.iso,
        shutter: r.shutter,
        sensor_fps: r.sensor_fps,
        white_balance: r.white_balance,
        scene: r.scene,
        take: r.take,
        circled: r.circled || false,
        day_night: r.day_night,
        int_ext: r.int_ext,
        location: r.location,
        director: r.director,
        dop: r.dop,
        sound_roll: r.sound_roll,
        sound_tc: r.sound_tc,
        colorspace: r.colorspace,
        look: r.look,
        lut: r.lut,
        cdl_slope_r: r.cdl_slope_r,
        cdl_slope_g: r.cdl_slope_g,
        cdl_slope_b: r.cdl_slope_b,
        cdl_offset_r: r.cdl_offset_r,
        cdl_offset_g: r.cdl_offset_g,
        cdl_offset_b: r.cdl_offset_b,
        cdl_power_r: r.cdl_power_r,
        cdl_power_g: r.cdl_power_g,
        cdl_power_b: r.cdl_power_b,
        cdl_saturation: r.cdl_saturation,
        shoot_date: r.shoot_date,
        shoot_day: r.shoot_day,
        ale_source: r.ale_source,
        custom_metadata: r.custom_metadata,
      }));
      
      // Upsert - update existing records on conflict
      const { data, error } = await supabase
        .from('source_media')
        .upsert(dbRecords, {
          onConflict: 'project_id,clip_name,tc_in_frames',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        console.error('Source media upsert error:', {
          batch: Math.floor(i / BATCH_SIZE) + 1,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        results.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        results.inserted += data?.length || 0;
      }
    }
    
    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
      total: records.length,
    });
    
  } catch (error) {
    console.error('Source media import error:', error);
    return NextResponse.json(
      { error: 'Failed to import source media', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth: any authenticated user can view source media
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;

    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    let query = supabase
      .from('source_media')
      .select('*', { count: 'exact' });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    if (search) {
      // Sanitize search input: escape special PostgREST filter characters
      // to prevent filter-string injection via the .or() method
      const sanitized = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/,/g, '')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/\./g, '');
      query = query.or(`clip_name.ilike.%${sanitized}%,scene.ilike.%${sanitized}%,camera.ilike.%${sanitized}%`);
    }
    
    query = query.order('clip_name', { ascending: true });
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      records: data,
      total: count,
      limit,
      offset,
    });
    
  } catch (error) {
    console.error('Source media fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch source media' },
      { status: 500 }
    );
  }
}
